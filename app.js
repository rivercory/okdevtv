const express = require('express');
const session = require('express-session');
const path = require('path');
const favicon = require('serve-favicon');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const frameguard = require('frameguard');
const passport = require('passport');
const FacebookStrategy = require('passport-facebook').Strategy;
const config = require('./config/config');
const Sentry = require("@sentry/node");
Sentry.init({
  dsn: "https://97d7b2e6ec3341f0b98ab3c50de2a3e2@o1431453.ingest.sentry.io/4503895780753408",
  tracesSampleRate: 1.0,
});
let helmet = require("helmet");
const app = express();
app.use(helmet.hidePoweredBy());

const cors = require('cors');
let corsOptions = {
  origin: 'okdevtv.com'
};
app.use(cors(corsOptions));

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
app.use(
  favicon(path.join(__dirname, 'public', 'favicon/apple-icon-180x180.png'))
);
app.use(logger('combined'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(frameguard({ action: 'sameorigin' }));
app.use(express.static(path.join(__dirname, 'public')));

const sess = {
  secret: 'okdevtv cat',
  resave: true,
  saveUninitialized: true,
  cookie: {}
};
app.use(session(sess));
app.use(passport.initialize());
app.use(passport.session());

try {
  // Passport session setup.
  passport.serializeUser(function (user, done) {
    done(null, user);
  });

  passport.deserializeUser(function (obj, done) {
    done(null, obj);
  });

  // Use the FacebookStrategy within Passport.
  passport.use(
    new FacebookStrategy(
      {
        clientID: config.facebook_api_key,
        clientSecret: config.facebook_api_secret,
        callbackURL: config.callback_url
      },
      function (_accessToken, _refreshToken, profile, done) {
        process.nextTick(function () {
          // Check whether the User exists or not using profile.id
          if (config.use_database) {
            // if sets to true
            pool.query(
              'SELECT * from user_info where user_id=' + profile.id,
              (err, rows) => {
                if (err) throw err;
                if (rows && rows.length === 0) {
                  console.log('There is no such user, adding now');
                  pool.query(
                    "INSERT into user_info(user_id,user_name) VALUES('" +
                    profile.id +
                    "','" +
                    profile.username +
                    "')"
                  );
                } else {
                  console.log('User already exists in database');
                }
              }
            );
          }
          return done(null, profile);
        });
      }
    )
  );
} catch (e) {
  console.error(e.message);
}

if (app.get('env') === 'production') {
  app.set('trust proxy', 1); // trust first proxy
  sess.cookie.secure = true; // serve secure cookies
}

app.use('/', require('./routes/index'));
app.use('/apis', require('./routes/apis'));
app.use('/user', require('./routes/user'));
app.use('/users', require('./routes/users'));
app.use('/hq', require('./routes/hq'));
app.use('/login', require('./routes/login'));
app.use('/mib*', require('./routes/mib'));

// catch 404 and forward to error handler
app.use(function (_req, res) {
  const err = new Error('Page Not Found');
  err.status = 404;
  res.render('error', {
    message: err.message,
    error: {}
  });
});

// error handlers
// no stacktraces leaked to user
app.use(function (err, _req, res) {
  Sentry.captureException(err);
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

module.exports = app;
