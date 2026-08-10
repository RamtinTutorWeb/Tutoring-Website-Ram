const express = require("express");
const SiteSettings = require("../models/SiteSettings");
const User = require("../models/User");
const { authMiddleware, adminOnly } = require("../middleware/auth");
const { sendMail } = require("../utils/mailer");

const router = express.Router();

const selectableOptionKeys = [
  "contactMethods",
  "serviceTypes",
  "urgencyWindows",
  "urgencyFlags",
  "assessmentSubjects",
  "courseCategories",
];

const defaultSelectableOptions = {
  contactMethods: ["Email", "Phone", "WhatsApp"],
  serviceTypes: ["High School", "University", "Exam Prep"],
  urgencyWindows: ["Within 2 weeks", "Within 1 month", "Within 3 months"],
  urgencyFlags: ["No", "Yes"],
  assessmentSubjects: ["Math", "Physics", "Both"],
  courseCategories: ["University Courses", "High School Courses", "Exam Prep"],
};

const defaultContent = {
  courses: [],
  examPrepTracks: [],
  reviews: [],
  faq: [],
  learnerCourses: [],
  sessionSlots: [],
  sessionSettings: {
    defaultDailySlots: 8,
    slotDurationMinutes: 90,
  },
  requests: [],
};

function normalizeOptions(options) {
  const normalized = {};
  for (const key of selectableOptionKeys) {
    const values = Array.isArray(options?.[key]) ? options[key] : defaultSelectableOptions[key];
    normalized[key] = [...new Set(values.map((value) => String(value).trim().replace(/\s+/g, " ")).filter(Boolean))];
  }
  return normalized;
}

async function getSettingsDocument() {
  const settings = await SiteSettings.findOneAndUpdate(
    { key: "global" },
    {
      $setOnInsert: {
        key: "global",
        selectableOptions: defaultSelectableOptions,
        ...defaultContent,
      },
    },
    { new: true, upsert: true }
  );

  const normalizedOptions = normalizeOptions(settings.selectableOptions);
  if (JSON.stringify(settings.selectableOptions) !== JSON.stringify(normalizedOptions)) {
    settings.selectableOptions = normalizedOptions;
    await settings.save();
  }

  return settings;
}

router.get("/", async (req, res) => {
  try {
    const settings = await getSettingsDocument();
    res.json({
      selectableOptions: settings.selectableOptions,
      content: {
        courses: settings.courses || [],
        examPrepTracks: settings.examPrepTracks || [],
        reviews: settings.reviews || [],
        faq: settings.faq || [],
        learnerCourses: settings.learnerCourses || [],
        sessionSlots: settings.sessionSlots || [],
        sessionSettings: settings.sessionSettings || defaultContent.sessionSettings,
        requests: settings.requests || [],
      },
    });
  } catch (err) {
    console.error("Get settings error:", err);
    res.status(500).json({ message: "Failed to load settings" });
  }
});

router.put("/content", authMiddleware, async (req, res) => {
  try {
    const content = req.body?.content || {};
    const settings = await SiteSettings.findOneAndUpdate(
      { key: "global" },
      {
        $set: {
          courses: Array.isArray(content.courses) ? content.courses : [],
          examPrepTracks: Array.isArray(content.examPrepTracks) ? content.examPrepTracks : [],
          reviews: Array.isArray(content.reviews) ? content.reviews : [],
          faq: Array.isArray(content.faq) ? content.faq : [],
          learnerCourses: Array.isArray(content.learnerCourses) ? content.learnerCourses : [],
          sessionSlots: Array.isArray(content.sessionSlots) ? content.sessionSlots : [],
          sessionSettings: content.sessionSettings || defaultContent.sessionSettings,
          requests: Array.isArray(content.requests) ? content.requests : [],
        },
      },
      { new: true, upsert: true, runValidators: true }
    );

    res.json({
      message: "Content updated",
      content: {
        courses: settings.courses || [],
        examPrepTracks: settings.examPrepTracks || [],
        reviews: settings.reviews || [],
        faq: settings.faq || [],
        learnerCourses: settings.learnerCourses || [],
        sessionSlots: settings.sessionSlots || [],
        sessionSettings: settings.sessionSettings || defaultContent.sessionSettings,
        requests: settings.requests || [],
      },
    });
  } catch (err) {
    console.error("Update content error:", err);
    res.status(500).json({ message: "Failed to update content" });
  }
});

router.post("/session-request-notification", authMiddleware, async (req, res) => {
  try {
    const { learnerName, tutorId, date, startTime, endTime, notes } = req.body || {};
    const tutor = tutorId ? await User.findById(tutorId).select("email firstname lastname username") : null;
    const admins = await User.find({ role: "admin" }).select("email");
    const recipients = [
      tutor?.email,
      ...admins.map((admin) => admin.email),
      process.env.ADMIN_EMAIL,
    ].filter(Boolean);

    if (!recipients.length) {
      return res.json({ message: "Session request saved. No email recipients configured." });
    }

    await sendMail({
      to: [...new Set(recipients)].join(","),
      subject: "New tutoring session request",
      html: `
        <p>A learner requested a tutoring session.</p>
        <p><strong>Learner:</strong> ${learnerName || "Not provided"}</p>
        <p><strong>Time:</strong> ${date || ""} ${startTime || ""}-${endTime || ""}</p>
        <p><strong>Notes:</strong> ${notes || "None"}</p>
      `,
    });

    res.json({ message: "Session request notification sent." });
  } catch (err) {
    console.error("Session request notification error:", err);
    res.json({ message: "Session request saved. Email notification was not sent." });
  }
});

router.put("/selectable-options", authMiddleware, adminOnly, async (req, res) => {
  try {
    const normalizedOptions = normalizeOptions(req.body?.selectableOptions);
    const settings = await SiteSettings.findOneAndUpdate(
      { key: "global" },
      { selectableOptions: normalizedOptions },
      { new: true, upsert: true, runValidators: true }
    );

    res.json({
      message: "Selectable options updated",
      selectableOptions: settings.selectableOptions,
    });
  } catch (err) {
    console.error("Update settings error:", err);
    res.status(500).json({ message: "Failed to update settings" });
  }
});

module.exports = router;
