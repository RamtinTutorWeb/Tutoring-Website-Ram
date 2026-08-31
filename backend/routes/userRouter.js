const express = require("express");

const {
	listUsers,
	getUserById,
	createUser,
	updateUser,
	deleteUser,
	registerUser,
	loginUser,
	forgotPassword,
	resetPassword,
	getUserDashboard,
} = require("../controllers/userController");

const { authMiddleware, adminOnly, signToken } = require("../middleware/auth");
const User = require("../models/User");
const passport = require("passport");

const userRouter = express.Router();

function hasGitHubOAuthConfig() {
	return Boolean(
		process.env.GITHUB_CLIENT_ID &&
			process.env.GITHUB_CLIENT_SECRET &&
			process.env.GITHUB_CALLBACK_URL,
	);
}

function hasGoogleOAuthConfig() {
	return Boolean(
		process.env.GOOGLE_CLIENT_ID &&
			process.env.GOOGLE_CLIENT_SECRET &&
			process.env.GOOGLE_CALLBACK_URL,
	);
}

// ===== IMPORTANT: Specific routes MUST come BEFORE parameterized routes, so re-organized it =====

// POST /users/register
userRouter.post("/register", registerUser);

// POST /users/login
userRouter.post("/login", loginUser);

// GET /users/alumni - Get all alumni tutors (NEW ROUTE)
userRouter.get("/alumni", async (req, res) => {
	try {
		console.log("Fetching all alumni users...");

		const alumni = await User.find({ role: "alumni" })
			.select(
				"username firstname lastname email skills cohort bio availability",
			)
			.sort({ createdAt: -1 });

		console.log(`Found ${alumni.length} alumni users`);
		res.json(alumni);
	} catch (err) {
		console.error("Get alumni error:", err);
		res.status(500).json({ error: "Server error", message: err.message });
	}
});

// GET /users/dashboard
userRouter.get("/dashboard", authMiddleware, getUserDashboard);

// GitHub OAuth routes
userRouter.get("/auth/github", (req, res, next) => {
	if (!hasGitHubOAuthConfig()) {
		return res.status(503).json({ message: "GitHub OAuth is not configured" });
	}

	const role = req.query.role || "learner"; //get the role from query params, default to 'learner'
	const state = JSON.stringify({ role }); //save the role into state parameter to be used when in the callback
	passport.authenticate("github", {
		scope: ["user:email"], //scope to get user's email
		prompt: "login", //force login prompt
		state: state, //pass the state parameter
	})(req, res, next); //this is a IIFE to call the function returned by passport.authenticate
});

userRouter.get(
	"/auth/github/callback",
	(req, res, next) => {
		if (!hasGitHubOAuthConfig()) {
			return res.status(503).json({ message: "GitHub OAuth is not configured" });
		}
		next();
	},
	passport.authenticate("github", {
		failureRedirect: "/login",
		session: false,
	}),
	(req, res) => {
		const token = signToken(req.user);
		// res.redirect(`http://localhost:5173?token=${token}`);

		//send the data back to the opener window (main window) and close the popup
		res.send(`
      <script>
        window.opener.postMessage(
          ${JSON.stringify({ token, user: req.user })},
          "${process.env.FRONTEND_URL || "http://localhost:5173"}"
        );
        window.close();
      </script>
    `);
	},
);

// Google OAuth routes
userRouter.get("/auth/google", (req, res, next) => {
	if (!hasGoogleOAuthConfig()) {
		return res.status(503).json({ message: "Google OAuth is not configured" });
	}

	const role = req.query.role || "learner"; //get the role from query params, default to 'learner'
	const state = JSON.stringify({ role }); //save the role into state parameter to be used when in the callback
	passport.authenticate("google", {
		scope: ["profile", "email"], //scope to get user's email
		state: state, //pass the state parameter
	})(req, res, next); //this is a IIFE to call the function returned by passport.authenticate
});

//google callback URI
userRouter.get(
	"/auth/google/callback",
	(req, res, next) => {
		if (!hasGoogleOAuthConfig()) {
			return res.status(503).json({ message: "Google OAuth is not configured" });
		}
		next();
	},
	passport.authenticate("google", {
		failureRedirect: "/login",
		session: false,
	}),
	(req, res) => {
		const token = signToken(req.user);
		// res.redirect(`http://localhost:5173?token=${token}`);

		//send the data back to the opener window (main window) and close the popup
		res.send(`
      <script>
        window.opener.postMessage(
          ${JSON.stringify({ token, user: req.user })},
          "${process.env.FRONTEND_URL || "http://localhost:5173"}"
        );
        window.close();
      </script>
    `);
	},
);

// GET /users/me/profile - Get current user's profile
userRouter.get("/me/profile", authMiddleware, async (req, res) => {
	if (!req.user) {
		return res.status(401).json({ message: "Not authenticated" });
	}
	try {
		const user = await User.findById(req.user._id);
		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}

		const base = {
			role: user.role,
			phone: user.phone || "",
			selectedSkills: user.selectedSkills || [],
			bio: user.bio || "",
			cohort: user.cohort || "",
			track: user.track || "",
			preferredSessionLength: user.preferredSessionLength || 30,
			preferredSessionType: user.preferredSessionType || "both",
			timezone: user.timezone || "America/New_York",
			skills: user.skills || [],
			availability: user.availability || [],
		};

		return res.json(base);
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: "Failed to load profile" });
	}
});

// PUT /users/me/profile - Update current user's profile
userRouter.put("/me/profile", authMiddleware, async (req, res) => {
	if (!req.user) {
		return res.status(401).json({ message: "Not authenticated" });
	}
	try {
		const user = await User.findById(req.user._id);
		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}

		const {
			phone,
			selectedSkills,
			bio,
			cohort,
			track,
			preferredSessionLength,
			preferredSessionType,
			timezone,
			skills,
			availability,
		} = req.body;

		if (phone !== undefined) {
			const cleanPhone = String(phone).trim();
			if (cleanPhone && !/^[+\d][\d\s().-]{6,24}$/.test(cleanPhone)) {
				return res.status(400).json({ message: "Please enter a valid phone number" });
			}
			user.phone = cleanPhone;
		}
		if (selectedSkills !== undefined) user.selectedSkills = selectedSkills;
		if (bio !== undefined) user.bio = bio;
		if (cohort !== undefined) user.cohort = cohort;
		if (track !== undefined) user.track = track;
		if (preferredSessionLength !== undefined) {
			user.preferredSessionLength = preferredSessionLength;
		}
		if (preferredSessionType !== undefined) {
			user.preferredSessionType = preferredSessionType;
		}
		if (timezone !== undefined) user.timezone = timezone;
		if (skills !== undefined) user.skills = skills;
		if (availability !== undefined) user.availability = availability;

		await user.save();

		res.json({
			role: user.role,
			phone: user.phone || "",
			selectedSkills: user.selectedSkills || [],
			bio: user.bio || "",
			cohort: user.cohort || "",
			track: user.track || "",
			preferredSessionLength: user.preferredSessionLength || 30,
			preferredSessionType: user.preferredSessionType || "both",
			timezone: user.timezone || "America/New_York",
			skills: user.skills || [],
			availability: user.availability || [],
		});
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: "Failed to save profile" });
	}
});

// ===== Parameterized routes come AFTER specific routes =====

// GET /users - list all users
userRouter.get("/", listUsers);

// GET /users/:id/availability
userRouter.get("/:id/availability", async (req, res) => {
	try {
		const user = await User.findById(req.params.id).select(
			"username firstname lastname availability",
		);

		if (!user) return res.status(404).json({ error: "User not found" });

		const events = user.availability.map((a) => ({
			title: user.firstname || user.username,
			date: a.date.toISOString().slice(0, 10),
		}));

		res.json(events);
	} catch (err) {
		res.status(400).json({ error: "Invalid request" });
	}
});

// GET /users/:id/dashboard (protected)
userRouter.get("/:id/dashboard", authMiddleware, async (req, res) => {
	try {
		const { id } = req.params;

		if (req.user._id !== id && req.user.role !== "admin") {
			return res
				.status(403)
				.json({ message: "Not authorized to view this dashboard" });
		}

		const user = await User.findById(id);
		if (!user) return res.status(404).json({ message: "User not found" });

		res.json({
			user,
			role: user.role,
		});
	} catch (err) {
		console.error(err);
		res.status(500).json({ message: "Error loading dashboard" });
	}
});

// GET /users/:id - get user by id
userRouter.get("/:id", getUserById);

// POST /users - create a new user
userRouter.post("/", createUser);

// PUT /users/:id - update a user
userRouter.put("/:id", authMiddleware, updateUser);

// DELETE /users/:id - delete a user
userRouter.delete("/:id", authMiddleware, deleteUser);
userRouter.post("/forgot-password", forgotPassword);
userRouter.post("/reset-password", resetPassword);

module.exports = userRouter;
