import { useState } from "react";

const DAYS = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
];

function HolidaysSetup({
  holidays,
  setHolidays,
  workingDays,
  setWorkingDays,
  specialWorkingDays,
  setSpecialWorkingDays,
  onContinue,
  onBack,
}) {
  const [holidayName, setHolidayName] = useState("");
  const [holidayDate, setHolidayDate] = useState("");

  const addHoliday = (e) => {
    e.preventDefault();

    if (!holidayDate) {
      alert("Please select a holiday date.");
      return;
    }

    const exists = holidays.some(
      (holiday) => holiday.date === holidayDate,
    );

    if (exists) {
      alert("A holiday already exists on this date.");
      return;
    }

    const newHoliday = {
      id: crypto.randomUUID(),
      name: holidayName.trim() || "Holiday",
      date: holidayDate,
    };

    setHolidays(
      [...holidays, newHoliday].sort((a, b) =>
        a.date.localeCompare(b.date),
      ),
    );

    setHolidayName("");
    setHolidayDate("");
  };

  const removeHoliday = (id) => {
    setHolidays(
      holidays.filter((holiday) => holiday.id !== id),
    );
  };


  const [specialName, setSpecialName] = useState("");
  const [specialDate, setSpecialDate] = useState("");

  const addSpecialWorkingDay = (e) => {
    e.preventDefault();
    if (!specialDate) return alert("Please select a date.");
    if (holidays.some((holiday) => holiday.date === specialDate)) return alert("This date is already a holiday.");
    if (specialWorkingDays.some((day) => day.date === specialDate)) return alert("A special working day already exists on this date.");
    setSpecialWorkingDays([...specialWorkingDays, { id: crypto.randomUUID(), date: specialDate, name: specialName.trim() || "Special working day" }].sort((a, b) => a.date.localeCompare(b.date)));
    setSpecialName("");
    setSpecialDate("");
  };

  const toggleWorkingDay = (day) => {
    setWorkingDays((current) => {
      if (current.includes(day)) {
        if (current.length === 1) {
          return current;
        }

        return current.filter((item) => item !== day);
      }

      return [...current, day];
    });
  };

  return (
    <section className="setup-container">
      <div className="setup-heading">
        <div className="hero-badge">CALENDAR SETUP</div>

        <h1>Set your working days.</h1>

        <p>
          Tell Attendly which days your university normally operates,
          then add your semester holidays.
        </p>
      </div>

      {/* WORKING DAYS */}

      <div className="calendar-section">
        <div className="section-heading">
          <h2>Working days</h2>

          <p>
            Select the days on which classes normally take place.
          </p>
        </div>

        <div className="working-days">
          {DAYS.map((day) => {
            const selected = workingDays.includes(day.key);

            return (
              <button
                key={day.key}
                type="button"
                className={`day-button ${
                  selected ? "selected" : ""
                }`}
                onClick={() => toggleWorkingDay(day.key)}
              >
                <span className="day-check">
                  {selected ? "✓" : ""}
                </span>

                {day.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ADD HOLIDAY */}

      <div className="calendar-section">
        <div className="section-heading">
          <h2>Add holidays</h2>

          <p>
            These dates will be excluded when calculating your
            actual classes.
          </p>
        </div>

        <form
          className="setup-card holiday-form"
          onSubmit={addHoliday}
        >
          <div className="holiday-input-grid">
            <div className="form-group">
              <label htmlFor="holiday-name">
                Holiday name
              </label>

              <input
                id="holiday-name"
                type="text"
                placeholder="e.g. Diwali"
                value={holidayName}
                onChange={(e) =>
                  setHolidayName(e.target.value)
                }
              />
            </div>

            <div className="form-group">
              <label htmlFor="holiday-date">
                Date
              </label>

              <input
                id="holiday-date"
                type="date"
                value={holidayDate}
                onChange={(e) =>
                  setHolidayDate(e.target.value)
                }
              />
            </div>
          </div>

          <button
            className="secondary-button"
            type="submit"
          >
            + Add Holiday
          </button>
        </form>
      </div>

      {/* HOLIDAY LIST */}

      {holidays.length > 0 ? (
        <div className="holidays-list">
          {holidays.map((holiday) => (
            <div
              className="holiday-card"
              key={holiday.id}
            >
              <div>
                <h3>{holiday.name}</h3>

                <p>{formatDate(holiday.date)}</p>
              </div>

              <button
                className="remove-button"
                type="button"
                onClick={() =>
                  removeHoliday(holiday.id)
                }
                aria-label={`Remove ${holiday.name}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-subjects">
          <span>+</span>

          <p>No holidays added yet.</p>

          <small>
            You can add holidays individually above.
          </small>
        </div>
      )}

      <div className="calendar-section">
        <div className="section-heading">
          <h2>Special working days</h2>
          <p>Add a date when classes are held outside your normal working-day pattern, such as a working Saturday.</p>
        </div>
        <form className="setup-card holiday-form" onSubmit={addSpecialWorkingDay}>
          <div className="holiday-input-grid">
            <div className="form-group"><label htmlFor="special-name">Name</label><input id="special-name" type="text" placeholder="e.g. Working Saturday" value={specialName} onChange={(e) => setSpecialName(e.target.value)} /></div>
            <div className="form-group"><label htmlFor="special-date">Date</label><input id="special-date" type="date" value={specialDate} onChange={(e) => setSpecialDate(e.target.value)} /></div>
          </div>
          <button className="secondary-button" type="submit">+ Add Working Day</button>
        </form>
        {specialWorkingDays.length > 0 && <div className="holidays-list">{specialWorkingDays.map((day) => <div className="holiday-card" key={day.id || day.date}><div><h3>{day.name}</h3><p>{formatDate(day.date)}</p></div><button className="remove-button" type="button" onClick={() => setSpecialWorkingDays(specialWorkingDays.filter((item) => item.date !== day.date))} aria-label={`Remove ${day.name}`}>×</button></div>)}</div>}
      </div>

      {/* ACTIONS */}

      <div className="setup-actions">
        <button
          className="back-button"
          type="button"
          onClick={onBack}
        >
          ← Back
        </button>

        <button
          className="primary-button"
          type="button"
          disabled={workingDays.length === 0}
          onClick={onContinue}
        >
          Calculate Semester
          <span>→</span>
        </button>
      </div>
    </section>
  );
}

function formatDate(dateString) {
  const date = new Date(`${dateString}T00:00:00`);

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default HolidaysSetup;