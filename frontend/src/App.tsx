import { Navigate, Route, Routes } from 'react-router-dom';
import { GuestRoute, ProtectedRoute } from './components/ProtectedRoute';
import { AuthLayout } from './layouts/AuthLayout';
import { DashboardLayout } from './layouts/DashboardLayout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import DoctorsPage from './pages/DoctorsPage';
import DoctorDetailsPage from './pages/DoctorDetailsPage';
import AvailableSlotsPage from './pages/AvailableSlotsPage';
import BookAppointmentPage from './pages/BookAppointmentPage';
import AppointmentsPage from './pages/AppointmentsPage';
import LiveQueuePage from './pages/LiveQueuePage';
import DoctorDashboardPage from './pages/DoctorDashboardPage';
import PrescriptionsPage from './pages/PrescriptionsPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import ProfilePage from './pages/ProfilePage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <Routes>
      <Route element={<GuestRoute />}>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/doctors" element={<DoctorsPage />} />
          <Route path="/doctors/:id" element={<DoctorDetailsPage />} />
          <Route path="/doctors/:id/slots" element={<AvailableSlotsPage />} />
          <Route path="/appointments" element={<AppointmentsPage />} />
          <Route path="/queue" element={<LiveQueuePage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route element={<ProtectedRoute roles={['PATIENT', 'RECEPTIONIST', 'ADMIN']} />}>
            <Route path="/book" element={<BookAppointmentPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={['ADMIN', 'DOCTOR', 'PATIENT']} />}>
            <Route path="/prescriptions" element={<PrescriptionsPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={['DOCTOR']} />}>
            <Route path="/doctor-dashboard" element={<DoctorDashboardPage />} />
          </Route>
          <Route element={<ProtectedRoute roles={['ADMIN']} />}>
            <Route path="/admin" element={<AdminDashboardPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
