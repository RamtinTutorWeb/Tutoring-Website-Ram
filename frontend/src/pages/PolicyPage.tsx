export default function PolicyPage() {
  return (
    <section data-page="policy" className="page">
      <h2>Policy</h2>
      <div className="grid-2">
        <div className="card">
          <h3>Session Policy</h3>
          <p>Students should reserve sessions through the available calendar slots or confirmed instructor communication.</p>
          <p>Cancellations and changes should be requested as early as possible so the slot can be reopened.</p>
        </div>
        <div className="card">
          <h3>Account Policy</h3>
          <p>Users are responsible for keeping login information private. Admins can trigger reset links when students need account help.</p>
          <p>Course progress and request details are used only to support tutoring operations.</p>
        </div>
      </div>
    </section>
  );
}
