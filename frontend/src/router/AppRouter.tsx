import { Navigate, Route, Routes } from "react-router-dom";
import { SignInPage, SignUpPage } from "../auth/AuthPages";
import { RequireAdmin, RequireAuth } from "../auth/guards";
import AssessmentPage from "../pages/AssessmentPage";
import BookPage from "../pages/BookPage";
import ContactPage from "../pages/ContactPage";
import CoursesPage from "../pages/CoursesPage";
import DashboardPage from "../pages/dashboard/DashboardPage";
import ExamPrepPage from "../pages/ExamPrepPage";
import HomePage from "../pages/HomePage";
import PolicyPage from "../pages/PolicyPage";
import ProfilePage from "../pages/ProfilePage";
import SettingsPage from "../pages/settings/SettingsPage";

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/courses" element={<CoursesPage />} />
      <Route path="/exam-prep" element={<ExamPrepPage />} />
      <Route path="/assessment" element={<AssessmentPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/book" element={<BookPage />} />
      <Route path="/policy" element={<PolicyPage />} />
      <Route path="/sign-in/*" element={<SignInPage />} />
      <Route path="/sign-up/*" element={<SignUpPage />} />
      <Route path="/login" element={<Navigate to="/sign-in" replace />} />
      <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
      <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
      <Route path="/settings" element={<RequireAdmin><SettingsPage /></RequireAdmin>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
