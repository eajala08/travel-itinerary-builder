import jsPDF from 'jspdf';
import type { ItineraryResponse } from '../types/itinerary';

export default function ExportButton({ itinerary }: { itinerary: ItineraryResponse }) {
  const handleExportPDF = () => {
    const doc = new jsPDF();
    let y = 20;

    doc.setFontSize(20);
    doc.text(itinerary.destination, 20, y);
    y += 8;

    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`${itinerary.dates[0]} to ${itinerary.dates[itinerary.dates.length - 1]}`, 20, y);
    y += 6;
    doc.text(`Budget: $${itinerary.estimated_spend} / $${itinerary.total_budget}`, 20, y);
    y += 10;

    itinerary.itinerary.forEach((day) => {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text(`Day ${day.day} — ${day.theme}`, 20, y);
      y += 7;

      doc.setFontSize(10);
      day.activities.forEach((a) => {
        doc.text(`• ${a.time} ${a.name} ($${a.estimated_cost})`, 25, y);
        y += 5;
      });
      day.meals.forEach((m) => {
        doc.text(`• ${m.time} ${m.type}: ${m.name} ($${m.budget})`, 25, y);
        y += 5;
      });
      y += 5;
    });

    doc.save(`${itinerary.destination.replace(/[^a-z0-9]/gi, '-')}-itinerary.pdf`);
  };

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(itinerary, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${itinerary.destination.replace(/[^a-z0-9]/gi, '-')}-itinerary.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex gap-3">
      <button
        onClick={handleExportPDF}
        className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition font-medium"
      >
        ⬇ Export PDF
      </button>
      <button
        onClick={handleExportJSON}
        className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition font-medium"
      >
        ⬇ Export JSON
      </button>
    </div>
  );
}
