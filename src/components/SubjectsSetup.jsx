import { useState } from "react";
import { getExpectedClasses } from "../utils/attendance";

function SubjectsSetup({ subjects, setSubjects, onContinue, onBack }) {
  const [name, setName] = useState("");
  const [credits, setCredits] = useState("");

  const addSubject = (e) => {
    e.preventDefault();

    const trimmedName = name.trim();
    const creditValue = Number(credits);

    if (!trimmedName) {
      alert("Please enter a subject name.");
      return;
    }

    if (!creditValue || creditValue <= 0) {
      alert("Please enter valid credits.");
      return;
    }

    const alreadyExists = subjects.some(
      (subject) =>
        subject.name.toLowerCase() === trimmedName.toLowerCase(),
    );

    if (alreadyExists) {
      alert("This subject has already been added.");
      return;
    }

    const newSubject = {
      id: crypto.randomUUID(),
      name: trimmedName,
      credits: creditValue,
      expectedClasses: getExpectedClasses(creditValue),
    };

    setSubjects([...subjects, newSubject]);

    setName("");
    setCredits("");
  };

  const removeSubject = (id) => {
    setSubjects(subjects.filter((subject) => subject.id !== id));
  };

  return (
    <section className="setup-container">
      <div className="setup-heading">
        <div className="hero-badge">SUBJECTS</div>

        <h1>Add your subjects.</h1>

        <p>
          One credit represents 15 classes. Attendly will calculate the
          expected classes automatically.
        </p>
      </div>

      <form className="setup-card subject-form" onSubmit={addSubject}>
        <div className="subject-input-grid">
          <div className="form-group">
            <label htmlFor="subject-name">Subject name</label>

            <input
              id="subject-name"
              type="text"
              placeholder="e.g. Machine Learning"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="subject-credits">Credits</label>

            <input
              id="subject-credits"
              type="number"
              min="1"
              max="20"
              placeholder="e.g. 4"
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
            />
          </div>
        </div>

        <button className="secondary-button" type="submit">
          + Add Subject
        </button>
      </form>

      {subjects.length > 0 && (
        <div className="subjects-list">
          {subjects.map((subject, index) => (
            <div className="subject-card" key={subject.id}>
              <div className="subject-info">
                <span className="subject-index">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <div>
                  <h3>{subject.name}</h3>

                  <p>
                    {subject.credits}{" "}
                    {subject.credits === 1 ? "credit" : "credits"}
                  </p>
                </div>
              </div>

              <div className="subject-right">
                <div className="expected-classes">
                  <strong>{subject.expectedClasses}</strong>
                  <span>expected classes</span>
                </div>

                <button
                  className="remove-button"
                  type="button"
                  onClick={() => removeSubject(subject.id)}
                  aria-label={`Remove ${subject.name}`}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {subjects.length === 0 && (
        <div className="empty-subjects">
          <span>+</span>
          <p>No subjects added yet.</p>
          <small>Add your first subject above.</small>
        </div>
      )}

      <div className="setup-actions">
        <button className="back-button" type="button" onClick={onBack}>
          ← Back
        </button>

        <button
          className="primary-button"
          type="button"
          disabled={subjects.length === 0}
          onClick={onContinue}
        >
          Continue
          <span>→</span>
        </button>
      </div>
    </section>
  );
}

export default SubjectsSetup;