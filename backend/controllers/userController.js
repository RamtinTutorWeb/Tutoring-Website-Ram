const User = require("../models/User");
const jwt = require("jsonwebtoken");
const secret = process.env.JWT_SECRET;
const expiration = "24h"; // Token will be valid for 2 hours

const crypto = require("crypto");
const bcrypt = require("bcrypt");

const { sendMail } = require("../utils/mailer");

function isValidEmail(email) {
	return /.+@.+\..+/.test(email);
}

function formatDuplicateField(field) {
	if (field === "email") return "This email is already registered. Please log in or use another email.";
	if (field === "username") return "This username is already taken. Please use another email or username.";
	return `${field} already exists.`;
}

function getValidationMessage(error) {
	const messages = Object.values(error.errors).map((err) => {
		if (err.path === "email") return "Please enter a valid email address.";
		if (err.path === "password") return "Please enter a valid password.";
		if (err.path === "username") return "Please enter a username.";
		if (err.path === "role") return "Please select a valid account role.";
		return err.message;
	});
	return messages.join(" ");
}

function sendServerError(res, action, error) {
	console.error(`${action} error:`, error);
	if (error.name === "MongoServerSelectionError" || error.name === "MongooseServerSelectionError") {
		return res.status(503).json({
			message: "The database is temporarily unavailable. Please try again in a few minutes.",
		});
	}

	return res.status(500).json({
		message: "Something went wrong on the server. Please try again later.",
	});
}

async function listUsers(req, res) {
	try {
		const users = await User.find();
		res.json(users);
	} catch (err) {
		res.status(500).json({ error: "Server error" });
	}
}

async function getUserById(req, res) {
	try {
		const user = await User.findById(req.params.id);
		if (!user) return res.status(404).json({ error: "User not found" });
		res.json(user);
	} catch (err) {
		res.status(400).json({ error: "Invalid ID" });
	}
}

async function createUser(req, res) {
	try {
		const newUser = await User.create(req.body);
		res.status(201).json(newUser);
	} catch (err) {
		res.status(400).json({ error: err.message || "Bad request" });
	}
}

async function updateUser(req, res) {
	try {
		const updated = await User.findByIdAndUpdate(req.params.id, req.body, {
			new: true,
			runValidators: true,
		});
		if (!updated) return res.status(404).json({ error: "User not found" });
		res.json(updated);
	} catch (err) {
		res.status(400).json({ error: err.message || "Invalid request" });
	}
}

async function deleteUser(req, res) {
	try {
		const deleted = await User.findByIdAndDelete(req.params.id);
		if (!deleted) return res.status(404).json({ error: "User not found" });
		res.json({ message: "User deleted" });
	} catch (err) {
		res.status(400).json({ error: "Invalid ID" });
	}
}

// async function registerUser(req, res) {
// 	try {

// 		//check if email exist
// 		const alreadyExist = await User.findOne({ email: req.body.email });
// 		if (alreadyExist) {
// 			return res.status(400).json({ message: "Email already exists" });
// 		}
// 		/** You can also check for username, same login as above */

// 		//create a new user
// 		const user = await User.create(req.body);

// 		res.status(201).json({
// 			message: `User created: username: ${req.body.username} and email: ${req.body.email}`,
// 		});
// 	} catch (error) {
// 		console.log(error.message);
// 		//check for username duplication error
// 		if (error.code === 11000) {
// 			res.status(400).json({ message: "Username already in use" });
// 		} else {
// 			res.status(500).send("An unexpected error occurred.");
// 		}
// 	}
// }

async function registerUser(req, res) {
	try {
		console.log("=== REGISTRATION ATTEMPT ===");
		console.log("Request body:", req.body);

		const username = String(req.body.username || "").trim();
		const email = String(req.body.email || "").trim().toLowerCase();
		const password = req.body.password;
		const role = req.body.role;

		if (!username) {
			console.log("Missing required fields");
			return res.status(400).json({
				message: "Please enter your name.",
			});
		}

		if (!email) {
			return res.status(400).json({ message: "Please enter your email address." });
		}

		if (!isValidEmail(email)) {
			return res.status(400).json({ message: "Please enter a valid email address." });
		}

		if (!password) {
			return res.status(400).json({ message: "Please enter a password." });
		}

		if (String(password).length < 8) {
			return res.status(400).json({ message: "Password must be at least 8 characters long." });
		}

		console.log("Checking if email exists...");
		const alreadyExist = await User.findOne({ email });
		if (alreadyExist) {
			console.log("Email already exists");
			return res.status(400).json({
				message: "This email is already registered. Please log in or use another email.",
			});
		}

		console.log("Checking if username exists...");
		const usernameExists = await User.findOne({ username });
		if (usernameExists) {
			console.log("Username already exists");
			return res.status(400).json({
				message: "This username is already taken. Please use another email or username.",
			});
		}

		//validate users role
		if (role && !["learner", "alumni", "admin"].includes(role)) {
			console.log("Invalid role provided:", role);
			return res.status(400).json({ message: "Please select a valid account role." });
		}

		if (role === "admin") {
			const configuredAdminCode = String(process.env.ADMIN_SIGNUP_CODE || "");
			const submittedAdminCode = String(req.body.adminSignupCode || "");

			if (!configuredAdminCode) {
				return res.status(403).json({
					message: "Admin signup is not configured. Please contact the site owner.",
				});
			}

			if (submittedAdminCode !== configuredAdminCode) {
				return res.status(403).json({
					message: "Invalid admin access code.",
				});
			}
		}

		console.log("Creating new user...");
		const user = await User.create({
			username,
			email,
			password,
			role: role || "learner",
			firstname: req.body.firstname || "",
			lastname: req.body.lastname || "",
		});

		console.log("User created successfully:", user._id);

		res.status(201).json({
			message: `User created: username: ${username} and email: ${email}`,
		});
	} catch (error) {
		console.error("=== REGISTRATION ERROR ===");
		console.error("Error name:", error.name);
		console.error("Error message:", error.message);
		console.error("Full error:", error);

		// Check for duplicate key error
		if (error.code === 11000) {
			const field = Object.keys(error.keyPattern)[0];
			return res.status(400).json({
				message: formatDuplicateField(field),
			});
		}

		// Mongoose validation errors
		if (error.name === "ValidationError") {
			return res.status(400).json({
				message: getValidationMessage(error),
			});
		}

		return sendServerError(res, "Registration", error);
	}
}

async function loginUser(req, res) {
	try {
		const email = String(req.body.email || "").trim().toLowerCase();
		const password = req.body.password;

		if (!email) return res.status(400).json({ message: "Please enter your email address." });
		if (!password) return res.status(400).json({ message: "Please enter your password." });
		if (!isValidEmail(email)) return res.status(400).json({ message: "Please enter a valid email address." });

		//check if user doesn't exist
		const dbUser = await User.findOne({ email });

		if (!dbUser) {
			return res.status(400).json({ message: "The email or password is incorrect." });
		}

		//if user found
		const passwordMatched = await dbUser.isCorrectPassword(password);

		if (!passwordMatched) {
			return res.status(400).json({ message: "The email or password is incorrect." });
		}

		//Create the JWT payload
		const payload = {
			_id: dbUser._id,
			username: dbUser.username,
			email: dbUser.email,
			role: dbUser.role,
		};

		//Create Token
		const token = jwt.sign({ data: payload }, secret, {
			expiresIn: expiration,
		});

		res.json({ token, dbUser });
	} catch (error) {
		return sendServerError(res, "Login", error);
	}
}

/** forgotPassword */
async function forgotPassword(req, res) {
	try {
		console.log("FORGOT PASSWORD HIT:", req.body);

		const { email } = req.body;
		if (!email) return res.status(400).json({ message: "Email is required" });

		const user = await User.findOne({ email });

		// Always return the same message (avoid leaking which emails exist)
		if (!user) {
			return res.json({
				message: "If an account exists for that email, a reset link will be sent.",
			});
		}

		// Create a random token (send to user)
		const resetToken = crypto.randomBytes(32).toString("hex");

		// Hash token before saving (so DB leak doesn't allow resets)
		const tokenHash = await bcrypt.hash(resetToken, 10);

		user.resetPasswordTokenHash = tokenHash;
		user.resetPasswordExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
		await user.save();

		// MVP: log link in console (later replace with email service like SendGrid/Resend)
		const resetLink = `${process.env.FRONTEND_URL}/reset-password?email=${encodeURIComponent(
			email
		)}&token=${resetToken}`;

		// console.log("🔐 Password reset link:", resetLink);
		await sendMail({
		to: user.email,
		subject: "Reset your PeerTrack+ password",
		html: `
			<p>You requested a password reset.</p>
			<p>Click the link below to reset your password:</p>
			<a href="${resetLink}">${resetLink}</a>
			<p>This link expires in 15 minutes.</p>
		`,
		});
		return res.json({
			message: "If an account exists for that email, a reset link will be sent.",

			// resetLink, // ❌ remove in production
		});
	} catch (err) {
		// return res.status(500).json({ message: "Server error" });
		console.error("FORGOT/RESET PASSWORD ERROR:", err);
		return res.status(500).json({ message: err.message || "Server error" });
	}
}

async function resetPassword(req, res) {
	try {
		const { email, token, newPassword } = req.body;

		if (!email || !token || !newPassword) {
			return res.status(400).json({
				message: "email, token, and newPassword are required",
			});
		}

		const user = await User.findOne({ email }).select(
			"+resetPasswordTokenHash resetPasswordExpiresAt"
		);

		if (!user || !user.resetPasswordTokenHash) {
			return res.status(400).json({ message: "Invalid or expired reset token" });
		}

		if (user.resetPasswordExpiresAt && user.resetPasswordExpiresAt < new Date()) {
			return res.status(400).json({ message: "Invalid or expired reset token" });
		}

		const tokenMatches = await bcrypt.compare(token, user.resetPasswordTokenHash);
		if (!tokenMatches) {
			return res.status(400).json({ message: "Invalid or expired reset token" });
		}

		// Update password (your User pre-save hook will hash it)
		user.password = newPassword;

		// Invalidate token (single-use)
		user.resetPasswordTokenHash = undefined;
		user.resetPasswordExpiresAt = undefined;

		await user.save();

		return res.json({ message: "Password reset successful" });
	} catch (err) {
		return res.status(500).json({ message: "Server error" });
	}
}
/******* */

async function getUserDashboard(req, res) {
	try {
		if (!req.user) return res.status(401).json({ message: "Unauthorized" });

		const user = await User.findById(req.user._id).select(
			"username firstname lastname email role skills cohort sessions availability createdAt updatedAt"
		);

		if (!user) return res.status(404).json({ error: "User not found" });

		res.json({
			_id: user._id,
			username: user.username,
			firstname: user.firstname,
			lastname: user.lastname,
			email: user.email,
			role: user.role,
			skills: user.skills,
			cohort: user.cohort,
			sessions: user.sessions,
			availability: user.availability,
			createdAt: user.createdAt,
			updatedAt: user.updatedAt,
		});
	} catch (err) {
		res.status(400).json({ error: "Invalid request" });
	}
}
// async function getUserDashboard(req, res) {
//   try {
//     const user = await User.findById(req.params.id).select(
//       "username firstname lastname email role skills cohort sessions availability createdAt updatedAt"
//     );

//     if (!user) return res.status(404).json({ error: "User not found" });

//     res.json({
//       _id: user._id,
//       username: user.username,
//       firstname: user.firstname,
//       lastname: user.lastname,
//       email: user.email,
//       role: user.role,
//       skills: user.skills,
//       cohort: user.cohort,
//       sessions: user.sessions,
//       availability: user.availability,
//       createdAt: user.createdAt,
//       updatedAt: user.updatedAt,
//     });
//   } catch (err) {
//     res.status(400).json({ error: "Invalid request" });
//   }
// }

module.exports = {
	listUsers,
	getUserById,
	createUser,
	updateUser,
	deleteUser,
	registerUser,
	loginUser,
	getUserDashboard,
	forgotPassword,
	resetPassword,
};
