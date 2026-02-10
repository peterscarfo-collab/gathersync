const anchors = document.querySelectorAll('a[href^="#"]');

anchors.forEach((anchor) => {
  anchor.addEventListener("click", (event) => {
    const href = anchor.getAttribute("href");
    if (!href || href === "#") return;
    const target = document.querySelector(href);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

const nav = document.querySelector(".nav");
window.addEventListener("scroll", () => {
  if (!nav) return;
  nav.style.boxShadow =
    window.scrollY > 80 ? "0 2px 12px rgba(0, 0, 0, 0.08)" : "none";
});

const contactForm = document.getElementById("contactForm");
const formNote = document.getElementById("formNote");

if (contactForm instanceof HTMLFormElement) {
  contactForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(contactForm);
    const name = String(formData.get("name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const message = String(formData.get("message") || "").trim();
    const organization = String(formData.get("organization") || "").trim();

    if (!name || !email || !message) {
      if (formNote) formNote.textContent = "Please fill out all required fields.";
      return;
    }

    const subject = encodeURIComponent("GatherSync website inquiry");
    const body = encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\nOrganization: ${organization || "N/A"}\n\nMessage:\n${message}`,
    );
    const mailto = `mailto:hello@gathersync.app?subject=${subject}&body=${body}`;
    window.location.href = mailto;

    if (formNote) {
      formNote.textContent =
        "Opening your email client now. If it did not open, email hello@gathersync.app.";
    }
  });
}
