import type { ItineraryResponse } from '../types/itinerary';
import { buildICS } from '../lib/ics';
import { money } from '../lib/format';
import { buildTimeline } from '../lib/timeline';

export default function ExportButton({ itinerary }: { itinerary: ItineraryResponse }) {
  const handleExportPDF = async () => {
    // Loaded on demand: jsPDF (+ html2canvas) is most of the bundle otherwise.
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    const pageBottom = 280;
    let y = 20;

    // Writes wrapped text and starts a new page instead of running off the bottom.
    const write = (text: string, x: number, size: number, color = 0, gap = 1.5) => {
      doc.setFontSize(size);
      doc.setTextColor(color);
      const lines: string[] = doc.splitTextToSize(text, 190 - x);
      const lineHeight = size * 0.45;
      lines.forEach((line) => {
        if (y > pageBottom) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, x, y);
        y += lineHeight;
      });
      y += gap;
    };

    write(itinerary.destination, 20, 20, 0, 3);
    write(`${itinerary.dates[0]} to ${itinerary.dates[itinerary.dates.length - 1]}`, 20, 11, 100);
    write(`Estimated spend: ${money(itinerary.estimated_spend)} of ${money(itinerary.total_budget)}`, 20, 11, 100, 6);

    itinerary.itinerary.forEach((day) => {
      if (y > pageBottom - 20) {
        doc.addPage();
        y = 20;
      }
      write(`Day ${day.day} (${day.date}): ${day.theme}`, 20, 14, 0, 1);
      if (day.weather) {
        write(`${day.weather.condition}, ${day.weather.temp_c}°C. ${day.weather.advice}`, 25, 9, 110);
      }
      buildTimeline(day).forEach((entry) => {
        write(`${entry.time}  ${entry.title} (${entry.tag})`, 25, 10, 0, 0.5);
        if (entry.detail) write(entry.detail, 30, 9, 110, 1);
      });
      if (day.travel_tips) write(`Tip: ${day.travel_tips}`, 25, 9, 90);
      write(`Day total: ${money(day.daily_spend.total)}`, 25, 9, 90, 6);
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

  const handleExportCalendar = () => {
    const ics = buildICS(itinerary);
    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${itinerary.destination.replace(/[^a-z0-9]/gi, '-')}-itinerary.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        onClick={handleExportPDF}
        className="bg-red-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-red-700 transition font-medium text-xs whitespace-nowrap"
      >
        ⬇ PDF
      </button>
      <button
        onClick={handleExportJSON}
        className="bg-gray-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-gray-700 transition font-medium text-xs whitespace-nowrap"
      >
        ⬇ JSON
      </button>
      <button
        onClick={handleExportCalendar}
        className="bg-blue-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-blue-700 transition font-medium text-xs whitespace-nowrap"
        title="Downloads a .ics file to import into Google Calendar, Apple Calendar, or Outlook"
      >
        📅 Calendar
      </button>
    </div>
  );
}
