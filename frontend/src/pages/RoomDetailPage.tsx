import { useParams } from "react-router-dom";

export default function RoomDetailPage() {
  const { roomId } = useParams<{ roomId: string }>();

  return (
    <section className="page">
      <h1>Raumdetails</h1>
      <p className="placeholder">
        Die Tagesansicht des Raums {roomId} wird in einem späteren Schritt
        umgesetzt.
      </p>
    </section>
  );
}
