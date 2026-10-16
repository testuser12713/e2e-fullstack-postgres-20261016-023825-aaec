import { Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell";
import RoomsPage from "./pages/RoomsPage";
import RoomDetailPage from "./pages/RoomDetailPage";
import NewBookingPage from "./pages/NewBookingPage";
import AvailabilityPage from "./pages/AvailabilityPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<RoomsPage />} />
        <Route path="/rooms/:roomId" element={<RoomDetailPage />} />
        <Route path="/bookings/new" element={<NewBookingPage />} />
        <Route path="/availability" element={<AvailabilityPage />} />
      </Route>
    </Routes>
  );
}
