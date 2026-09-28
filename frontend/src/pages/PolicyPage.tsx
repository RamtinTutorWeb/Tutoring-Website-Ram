export default function PolicyPage() {
  return (
    <section data-page="policy" className="page">
      <h2>Policy</h2>
      <div className="grid-2">
        <div className="card">
          <h3>Session Policy</h3>
          <p>Send a tutoring request first. Once it is accepted you will receive a link to book a time through our online scheduler.</p>
          <p>Cancellations and changes should be made as early as possible using the links in your booking confirmation email.</p>
        </div>
        <div className="card">
          <h3>Account Policy</h3>
          <p>Users are responsible for keeping login information private. Password resets and sign-in methods are managed from your account menu.</p>
          <p>Course progress and request details are used only to support tutoring operations.</p>
        </div>
      </div>
    </section>
  );
}
