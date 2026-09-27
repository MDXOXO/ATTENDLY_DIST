import { useMemo } from "react";

const DAYS = [
  { key: "monday", label: "Mon" },
  { key: "tuesday", label: "Tue" },
  { key: "wednesday", label: "Wed" },
  { key: "thursday", label: "Thu" },
  { key: "friday", label: "Fri" },
  { key: "saturday", label: "Sat" },
];

function TimetableSetup({
  subjects,
  timetable,
  setTimetable,
  onContinue,
  onBack,
}) {
  const updateClassCount = (subjectId, day, value) => {
    const count = Math.max(0, Math.min(5, Number(value) || 0));

    setTimetable((current) => ({
      ...current,
      [subjectId]: {
        ...current[subjectId],
        [day]: count,
      },
    }));
  };

  const weeklyTotals = useMemo(() => {
    return subjects.reduce((totals, subject) => {
      const schedule = timetable[subject.id] || {};

      totals[subject.id] = DAYS.reduce(
        (sum, day) => sum + Number(schedule[day.key] || 0),
        0,
      );

      return totals;
    }, {});
  }, [subjects, timetable]);

  const totalWeeklyClasses = Object.values(weeklyTotals).reduce(
    (sum, value) => sum + value,
    0,
  );

  const hasClasses = totalWeeklyClasses > 0;

  return (
    <section className="setup-container timetable-container">
      <div className="setup-heading">
        <div className="hero-badge">WEEKLY TIMETABLE</div>

        <h1>How many classes do you have?</h1>

        <p>
          Enter the number of classes you have for each subject on each
          weekday. You can start with weekly class counts. Amizone sync can later add exact times, rooms and faculty for imported sessions.
        </p>
      </div>

      <div className="timetable-card">
        <div className="timetable-scroll">
          <table className="timetable">
            <thead>
              <tr>
                <th>Subject</th>

                {DAYS.map((day) => (
                  <th key={day.key}>{day.label}</th>
                ))}

                <th>Total</th>
              </tr>
            </thead>

            <tbody>
              {subjects.map((subject) => {
                const schedule = timetable[subject.id] || {};

                return (
                  <tr key={subject.id}>
                    <td className="timetable-subject">
                      {subject.name}
                    </td>

                    {DAYS.map((day) => (
                      <td key={day.key}>
                        <input
                          className="class-count-input"
                          type="number"
                          min="0"
                          max="5"
                          value={schedule[day.key] ?? 0}
                          onChange={(e) =>
                            updateClassCount(
                              subject.id,
                              day.key,
                              e.target.value,
                            )
                          }
                        />
                      </td>
                    ))}

                    <td className="weekly-total">
                      {weeklyTotals[subject.id]}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            <tfoot>
              <tr>
                <td>Total classes</td>

                {DAYS.map((day) => {
                  const total = subjects.reduce(
                    (sum, subject) =>
                      sum +
                      Number(
                        timetable[subject.id]?.[day.key] || 0,
                      ),
                    0,
                  );

                  return <td key={day.key}>{total}</td>;
                })}

                <td>{totalWeeklyClasses}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="timetable-summary">
        <div>
          <span>Classes per week</span>
          <strong>{totalWeeklyClasses}</strong>
        </div>

        <div>
          <span>Subjects</span>
          <strong>{subjects.length}</strong>
        </div>
      </div>

      <div className="setup-actions">
        <button className="back-button" onClick={onBack}>
          ← Back
        </button>

        <button
          className="primary-button"
          disabled={!hasClasses}
          onClick={onContinue}
        >
          Continue
          <span>→</span>
        </button>
      </div>
    </section>
  );
}

export default TimetableSetup;