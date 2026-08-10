const mongoose = require("mongoose");

const { Schema } = mongoose;

const optionSchema = {
  type: [String],
  default: [],
};

const courseSchema = new Schema(
  {
    id: String,
    title: String,
    category: String,
    description: String,
  },
  { _id: false },
);

const reviewSchema = new Schema(
  {
    id: String,
    name: String,
    rating: Number,
    text: String,
    status: String,
  },
  { _id: false },
);

const faqSchema = new Schema(
  {
    id: String,
    question: String,
    answer: String,
  },
  { _id: false },
);

const learnerCourseSchema = new Schema(
  {
    id: String,
    userId: String,
    courseId: String,
    status: String,
    registeredAt: String,
  },
  { _id: false },
);

const sessionSlotSchema = new Schema(
  {
    id: String,
    tutorId: String,
    date: String,
    startTime: String,
    endTime: String,
    purpose: String,
    status: String,
    learnerName: String,
    notes: String,
  },
  { _id: false },
);

const sessionTypeSchema = new Schema(
  {
    id: String,
    purpose: String,
    durationMinutes: Number,
  },
  { _id: false },
);

const requestSchema = new Schema(
  {
    id: String,
    userId: String,
    name: String,
    contactMethod: String,
    email: String,
    phone: String,
    serviceType: String,
    subject: String,
    urgencyWindow: String,
    isUrgent: String,
    hardTopics: String,
    preferredSlot: String,
    earliestDate: String,
    message: String,
    consultation: Boolean,
    status: String,
    createdAt: String,
  },
  { _id: false },
);

const SiteSettingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "global" },
    selectableOptions: {
      contactMethods: optionSchema,
      serviceTypes: optionSchema,
      urgencyWindows: optionSchema,
      urgencyFlags: optionSchema,
      assessmentSubjects: optionSchema,
      courseCategories: optionSchema,
    },
    courses: { type: [courseSchema], default: [] },
    examPrepTracks: { type: [courseSchema], default: [] },
    reviews: { type: [reviewSchema], default: [] },
    faq: { type: [faqSchema], default: [] },
    learnerCourses: { type: [learnerCourseSchema], default: [] },
    sessionSlots: { type: [sessionSlotSchema], default: [] },
    sessionSettings: {
      defaultDailySlots: { type: Number, default: 8 },
      slotDurationMinutes: { type: Number, default: 90 },
      dayStartHour: { type: Number, default: 8 },
      dayEndHour: { type: Number, default: 20 },
      sessionTypes: { type: [sessionTypeSchema], default: [] },
    },
    requests: { type: [requestSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("SiteSettings", SiteSettingsSchema);
