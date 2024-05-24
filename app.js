
  require("dotenv").config();


const express = require("express");
const app = express();
const path = require("path");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const methodOverride = require("method-override");
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./model/user.js");
const Profile = require("./model/profile.js");
const moment = require("moment");

const { isLoggedIn, saveRedirectUrl } = require("./middleware.js");

let sessionOptions = session({
  secret: process.env.SECRET_KEY,
  resave: false,
  saveUninitialized: true,
  cookie: {
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
  },
});

app.use(sessionOptions);
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app
  .use(express.static(path.join(__dirname, "public")))
  .set("views", path.join(__dirname, "views"))
  .set("view engine", "ejs");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.use(express.json());

app.use((req, res, next) => {
  res.locals.successMsg = req.flash("success");
  res.locals.errorMsg = req.flash("err");
  res.locals.error = req.flash("error");
  res.locals.warning = req.flash("warn");
  res.locals.warningMsg = req.flash("warning");
  res.locals.success = req.flash("success1");
  res.locals.savedInfo = req.flash("savedInfo");
  res.locals.update = req.flash("update");
  res.locals.editWarn = req.flash("editWarn");
  res.locals.deleteMsg = req.flash("delete");
  res.locals.first = req.flash("first");
  res.locals.register = req.flash("register");
  res.locals.notFound = req.flash("notFound");
  next();
});

const port = process.env.PORT || 8000;
const dbUrl = process.env.ATLASDB_URL;

async function main() {
  await mongoose.connect(dbUrl);
}

main()
  .then(() => {
    console.log("Connection Succeeded");
  })
  .catch((err) => console.log(err));

app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}/main`);
});

app.get("/", (req, res) => {
  req.flash("welcome", "Welcome to TEDxCUSAT");
  res.redirect("/main");
});

app.get("/main", (req, res) => {
  res.render("main.ejs");
});

app.get("/new", (req, res) => {
  res.render("newUser.ejs");
});

app.post("/new", async (req, res, next) => {
  try {
    let { name, username, email, password } = req.body;
    let newUser = new User({
      name: name,
      username: username,
      email: email,
    });
    let registeredUser = await User.register(newUser, password);
    req.session.myId = registeredUser._id;
    req.login(registeredUser, async (err) => {
      if (err) {
        return next(err);
      }
      req.flash(
        "success",
        "User Registered Successfully !  Enter Your Details."
      );
    });

    res.render("newInfo.ejs");
  } catch (error) {
    req.flash(
      "err",
      "Username or Email-id is already registered ! "
    );
    res.redirect("/new");
  }
});


app.post("/info", async (req, res) => {
  try {
    let info = req.body;
    let newProfile = new Profile({
      owner: req.session.myId,
      sid: info.sid,
      dob: info.dob,
      gender: info.gender,
      year: info.year,
      branch: info.branch,
      college: info.college,
      address: info.address,
      contact: info.contact,
    });

    await newProfile.save();
    req.flash("savedInfo", "Your Details Has been saved! Login to See or Edit");
    res.redirect("/reg");
  } catch (err) {
    console.log(err);
    req.flash("savedInfo", "Your Details Has been saved! Login to See or Edit");
    res.redirect("/reg");
  }
});

app.get("/reg", (req, res) => {
  req.flash("warning", "You Have to Logged in First");
  res.render("reg.ejs");
});

app.post(
  "/reg",
  passport.authenticate("local", {
    failureRedirect: "/reg",
    failureFlash: true,
  }),
  async (req, res) => {
    try{
      let { username } = req.body;
    let user = await User.findOne({ username: username });
    let id = user._id;
    req.session.regId = id;
    let info = await Profile.findOne({ owner: id });
    let formattedDate = moment(info.dob).format("MMM DD YYYY");
    res.render("show.ejs", { info, user, formattedDate });
    }catch(err){
    let { username } = req.body;
    let user = await User.findOne({ username: username });
    await User.findByIdAndDelete({ _id: user._id });
    req.flash("register", "Please, Re-register Your Self ! ")
    res.redirect("/new");

    }
    
  }
);

app.get("/show", isLoggedIn, async (req, res) => {
  let user = await User.findOne({ _id: req.session.regId });
  let info = await Profile.findOne({ owner: user._id });
  let formattedDate = moment(info.dob).format("MMM DD YYYY");

  res.render("show.ejs", { info, user, formattedDate });
});
app.get("/edit", isLoggedIn, async (req, res) => {
  let user = await User.findOne({ _id: req.session.regId });
  let info = await Profile.findOne({ owner: user._id });
  res.render("edit.ejs", { user, info });
});

app.put("/edit", async (req, res, next) => {
  try {
    let updatedInfo = req.body;
    let user = await User.findOne({ _id: req.session.regId });
    let info = await Profile.findOne({ owner: user._id });
    await Profile.findByIdAndUpdate(info._id, {
      sid: updatedInfo.sid,
      dob: updatedInfo.dob,
      gender: updatedInfo.gender,
      year: updatedInfo.year,
      branch: updatedInfo.branch,
      college: updatedInfo.college,
      address: updatedInfo.address,
      contact: updatedInfo.contact,
    });
    await User.findByIdAndUpdate(user._id, {
      name: updatedInfo.name,
      email: updatedInfo.email,
    });
    req.flash("update", "Your Details Has Been Updated Successfully !");
    res.redirect("/show");
  } catch (err) {
    req.flash(
      "editWarn",
      "E-mail is already registered ! Please use different Email-id"
    );
    res.redirect("/edit");
  }
});

app.delete("/delete", isLoggedIn, async (req, res) => {
  let user = await User.findOne({ _id: req.session.regId });
  let info = await Profile.findOne({ owner: user._id });
  await Profile.findByIdAndDelete({ _id: info._id });
  await User.findByIdAndDelete({ _id: user._id });
  req.flash("delete", "You Data has been DELETED SUCCESSFULLY !");
  res.redirect("/main");
});

app.get("/logout", (req, res, next) => {
  req.logOut((err) => {
    if (err) {
      return next(err);
    } else {
      req.flash("success1", "You are Logged Out !");
      res.redirect("/main");
    }
  });
});

app.get("*", (req,res)=>{
 req.flash("notFound", "Page Not Found !")
  res.render("all.ejs");
})
