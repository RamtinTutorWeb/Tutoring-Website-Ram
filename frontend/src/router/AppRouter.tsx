import { Navigate, Route, Routes } from "react-router-dom";
import AssessmentPage from "../pages/AssessmentPage";
import AuthPage from "../pages/AuthPage";
import ContactPage from "../pages/ContactPage";
import CoursesPage from "../pages/CoursesPage";
import DashboardPage from "../pages/DashboardPage";
import ExamPrepPage from "../pages/ExamPrepPage";
import ForgotPasswordPage from "../pages/ForgotPasswordPage";
import HomePage from "../pages/HomePage";
import PolicyPage from "../pages/PolicyPage";
import ProfilePage from "../pages/ProfilePage";
import ResetPasswordPage from "../pages/ResetPasswordPage";
import { SignInPage, SignUpPage } from "../platform/auth";
import { BookPage } from "../platform/booking";

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/courses" element={<CoursesPage />} />
      <Route path="/exam-prep" element={<ExamPrepPage />} />
      <Route path="/assessment" element={<AssessmentPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/login" element={<AuthPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/settings" element={<DashboardPage adminView="settings" />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/policy" element={<PolicyPage />} />
      <Route path="/sign-in/*" element={<SignInPage />} />
      <Route path="/sign-up/*" element={<SignUpPage />} />
      <Route path="/book" element={<BookPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
