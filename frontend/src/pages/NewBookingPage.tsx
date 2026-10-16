import BookingForm from "../components/BookingForm";

export default function NewBookingPage() {
  return (
    <section className="page">
      <h1>Neue Buchung</h1>
      <p className="placeholder">
        Das Anlegen einer Buchung wird in einem späteren Schritt umgesetzt.
      </p>
      <BookingForm />
    </section>
  );
}
