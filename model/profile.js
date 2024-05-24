const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const User = require("./user.js");

const profileSchema = new Schema({
    owner: {
        type: Schema.Types.ObjectId,
        ref: "User",
    },
    sid: Number,
    dob: Date,
    gender: String,
    year: String,
    branch: String,
    college: String,
    address: String,
    contact: Number
})

const Profile = new mongoose.model("Profile", profileSchema);
module.exports = Profile;