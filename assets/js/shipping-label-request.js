(function () {
  var form = document.getElementById("shipping-label-form");
  if (!form) {
    return;
  }

  var statusNode = form.querySelector("[data-form-status]");
  var submitButton = form.querySelector("[data-submit-label]");
  var resultSection = document.querySelector("[data-label-result]");
  var labelLink = document.querySelector("[data-label-link]");
  var trackingNode = document.querySelector("[data-label-tracking]");
  var serviceNode = document.querySelector("[data-label-service]");
  var packageNode = document.querySelector("[data-label-package]");
  var originalButtonText = submitButton ? submitButton.textContent : "Generate Shipping Label";

  function setStatus(message, kind) {
    if (!statusNode) {
      return;
    }
    statusNode.textContent = message;
    statusNode.classList.remove("error", "success");
    if (kind) {
      statusNode.classList.add(kind);
    }
    statusNode.style.display = message ? "block" : "none";
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    setStatus("", "");

    if (!form.checkValidity()) {
      form.reportValidity();
      setStatus("Please complete all required fields before requesting a label.", "error");
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Generating...";
    }

    if (resultSection) {
      resultSection.hidden = true;
    }

    try {
      var payload = Object.fromEntries(new FormData(form).entries());
      var response = await fetch("/.netlify/functions/create-shipping-label", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      var data = {};
      try {
        data = await response.json();
      } catch (_error) {
        data = {};
      }

      if (!response.ok) {
        throw new Error(data.error || "We couldn't generate a label right now. Please call the lab and we'll help directly.");
      }

      if (labelLink) {
        labelLink.href = data.labelUrl || "#";
      }
      if (trackingNode) {
        trackingNode.textContent = data.trackingCode || "Tracking will appear after carrier acceptance.";
      }
      if (serviceNode) {
        serviceNode.textContent = [data.carrier, data.service].filter(Boolean).join(" ") || "Carrier service selected automatically";
      }
      if (packageNode) {
        packageNode.textContent = data.packageLabel || "Custom parcel";
      }

      if (resultSection) {
        resultSection.hidden = false;
        resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      setStatus("Shipping label generated successfully.", "success");
    } catch (error) {
      setStatus(error && error.message ? error.message : "We couldn't generate a label right now. Please call the lab.", "error");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
      }
    }
  });
})();
