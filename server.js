"use strict";

const express = require("express");
const bodyParser = require("body-parser");

const fccTesting = require("./freeCodeCamp/fcctesting.js");

const session = require("express-session");
const mongo = require("mongodb").MongoClient;
const passport = require("passport");
const GitHubStrategy = require("passport-github2").Strategy;

const app = express();

fccTesting(app); //For FCC testing purposes

app.use("/public", express.static(process.cwd() + "/public"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.set("view engine", "pug");

const dboptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true
};

let db;

// Setup database
mongo.connect(process.env.MONGO_URI, dboptions, (err, client) => {
  if (err) {
    console.log("Database error: " + err);
  } else {
    console.log("Successful database connection");
    db = client.db("nodedb");
    //db.collection("socialusers").deleteMany();
    app.use(
      session({
        secret: process.env.SESSION_SECRET,
        resave: true,
        saveUninitialized: true
      })
    );

    app.use(passport.initialize());
    app.use(passport.session());

    function ensureAuthenticated(req, res, next) {
      if (req.isAuthenticated()) {
        return next();
      }
      res.redirect("/");
    }

    passport.serializeUser((user, done) => {
      done(null, user.id);
    });

    passport.deserializeUser((id, done) => {
      db.collection("socialusers").findOne({ id: id }, (err, doc) => {
        done(null, doc);
      });
    });

    /*
     *  ADD YOUR CODE BELOW
     */

    passport.use(
      new GitHubStrategy(
        {
          clientID: process.env.GITHUB_CLIENT_ID,
          clientSecret: process.env.GITHUB_CLIENT_SECRET,
          callbackURL: process.env.GITHUB_CALLBACK_URL
        },
        function (accessToken, refreshToken, profile, done) {
          db.collection("socialusers").findOneAndUpdate(
            { id: profile.id },
            {
              $setOnInsert: {
                id: profile.id,
                name: profile.displayName || "John Doe",
                photo: profile.photos[0].value || "",
                email: profile.emails ? profile.emails[0].value : "No Public EMail",
                created_on: new Date(),
                provider: profile.provider || ""
              },
              $set: {
                last_login: new Date()
              },
              $inc: {
                login_count: 1
              }
            },
            { upsert: true, new: true },
            (err, doc) => {
              return done(null, doc.value);
            }
          );
        }
      )
    );

    app.all("/*", function (req, res, next) {
      res.header("Access-Control-Allow-Origin", "*");
      next();
    });

    /*
     *  ADD YOUR CODE ABOVE
     */
    app.route("/auth/github").get(function (req, res, next) {
      passport.authenticate("github", { 
        scope: ["user:email"] })(req, res, next),
        (req, res, next) => {
          next();
        };
    });

    app.route("/auth/github/callback").get(function (req, res, next) {
      passport.authenticate("github", {
        failureRedirect: "/",
        successRedirect: "/profile"
      })(req, res, next),
        (req, res, next) => {
          //res.redirect("/profile");
        };
    });

    app.route("/").get((req, res) => {
      res.render(process.cwd() + "/views/pug/index");
    });

    app.route("/profile").get(function (req, res) {
      res.render(process.cwd() + "/views/pug/profile", { user: req.user });
    });

    app.route("/logout").get((req, res) => {
      req.logout();
      res.redirect("/");
    });

    app.use((req, res, next) => {
      res
        .status(404)
        .type("text")
        .send("Not Found");
    });

    app.listen(process.env.PORT || 3000, () => {
      console.log("Listening on port " + process.env.PORT);
    });
  }
});
