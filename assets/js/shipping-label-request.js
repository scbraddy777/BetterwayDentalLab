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
      submitButton.textContent = "Submitting...";
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
        throw new Error(data.error || "We couldn't submit your request right now. Please call the lab and we'll help directly.");
      }

      if (resultSection) {
        resultSection.hidden = false;
        resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      if (trackingNode) {
        trackingNode.textContent = "Pending approval";
      }
      if (serviceNode) {
        serviceNode.textContent = "Assigned after approval";
      }
      if (packageNode) {
        packageNode.textContent = payload.packageType ? payload.packageType.replace(/_/g, " ") : "Pending";
      }
      if (labelLink) {
        labelLink.removeAttribute("href");
        labelLink.setAttribute("aria-disabled", "true");
        labelLink.textContent = "Label Sent After Approval";
      }

      setStatus(data.message || "Your shipping label request has been submitted for review.", "success");
    } catch (error) {
      setStatus(error && error.message ? error.message : "We couldn't submit your request right now. Please call the lab.", "error");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
      }
    }
  });
})();
