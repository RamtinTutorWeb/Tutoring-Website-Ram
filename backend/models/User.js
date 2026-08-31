const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const { Schema } = mongoose;

const UserSchema = new Schema(
	{
		selectedSkills: { type: [String], default: [] },
		bio: { type: String, default: "" },
		track: { type: String, default: "" },
		preferredSessionLength: { type: Number, default: 30 },
		preferredSessionType: {
			type: String,
			enum: ["video", "chat", "both"],
			default: "both",
		},
		timezone: { type: String, default: "America/New_York" },
		username: { type: String, required: true, trim: true },
		firstname: { type: String, trim: true },
		lastname: { type: String, trim: true },
		phone: { type: String, trim: true, default: "" },
		email: {
			type: String,
			required: true,
			unique: true,
			lowercase: true,
			trim: true,
			match: [/.+@.+\..+/, "Must match an email address!"],
		},
		githubId: { type: String },
		googleId: { type: String },
		password: { type: String, required: true },
		resetPasswordTokenHash: { type: String, select: false },
		resetPasswordExpiresAt: { type: Date },
		role: {
			type: String,
			enum: ["alumni", "learner", "admin"],
			required: true,
			default: "learner",
		},
		skills: { type: [String], default: [] },
		cohort: { type: String, trim: true },
		sessions: { type: [Date], default: [] },
		availability: [
			{
				date: { type: Date, required: true },
				startTime: { type: String },
				endTime: { type: String },
			},
		],
	},
	{ timestamps: true },
);

// Hash password before save - UPDATED FOR MONGOOSE 6+
UserSchema.pre("save", async function () {
	if (this.isNew || this.isModified("password")) {
		const saltRounds = 10;
		this.password = await bcrypt.hash(this.password, saltRounds);
	}
});

// Compare incoming password with hashed password
UserSchema.methods.isCorrectPassword = async function (password) {
	return bcrypt.compare(password, this.password);
};

module.exports = mongoose.model("User", UserSchema);
