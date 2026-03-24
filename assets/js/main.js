(function () {
  document.documentElement.classList.add("js");

  var body = document.body;
  var page = body ? body.getAttribute("data-page") : "";
  var yearNode = document.getElementById("year");
  if (yearNode) {
    yearNode.textContent = String(new Date().getFullYear());
  }

  if (page) {
    document.querySelectorAll("[data-nav]").forEach(function (link) {
      if (link.getAttribute("data-nav") === page) {
        link.classList.add("active");
      }
    });
  }

  var reveals = document.querySelectorAll("[data-reveal]");
  if ("IntersectionObserver" in window && reveals.length > 0) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
          }
        });
      },
      { threshold: 0.12 }
    );

    reveals.forEach(function (el) {
      observer.observe(el);
    });
  } else {
    reveals.forEach(function (el) {
      el.classList.add("is-visible");
    });
  }

  var ga4MeasurementId = window.BWDL_GA4_ID || "G-XXXXXXXXXX";
  if (ga4MeasurementId && ga4MeasurementId !== "G-XXXXXXXXXX") {
    var gaScript = document.createElement("script");
    gaScript.async = true;
    gaScript.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(ga4MeasurementId);
    document.head.appendChild(gaScript);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", ga4MeasurementId);
  }

  function trackEvent(name, params) {
    if (typeof window.gtag === "function") {
      window.gtag("event", name, params || {});
    }
  }

  document.querySelectorAll("[data-event]").forEach(function (node) {
    node.addEventListener("click", function () {
      var eventName = node.getAttribute("data-event");
      if (!eventName) {
        return;
      }
      trackEvent(eventName, {
        page_location: window.location.pathname,
        cta_text: (node.textContent || "").trim().slice(0, 60),
      });
    });
  });

  function bindNavDropdowns() {
    var dropdowns = document.querySelectorAll("[data-nav-dropdown]");
    if (!dropdowns.length) {
      return;
    }

    function setOpen(dropdown, nextState) {
      var toggle = dropdown.querySelector(".nav-dropdown-toggle");
      dropdown.classList.toggle("is-open", nextState);
      if (toggle) {
        toggle.setAttribute("aria-expanded", nextState ? "true" : "false");
      }
    }

    function closeAll(except) {
      dropdowns.forEach(function (dropdown) {
        if (except && dropdown === except) {
          return;
        }
        setOpen(dropdown, false);
      });
    }

    dropdowns.forEach(function (dropdown) {
      var toggle = dropdown.querySelector(".nav-dropdown-toggle");
      var firstItem = dropdown.querySelector(".nav-dropdown-menu a, .nav-dropdown-menu button");

      if (!toggle) {
        return;
      }

      toggle.addEventListener("click", function (event) {
        var shouldOpen = !dropdown.classList.contains("is-open");
        event.preventDefault();
        if (!shouldOpen) {
          setOpen(dropdown, false);
          return;
        }
        closeAll(dropdown);
        setOpen(dropdown, true);
      });

      toggle.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
          event.preventDefault();
          closeAll(dropdown);
          setOpen(dropdown, true);
          if (firstItem) {
            firstItem.focus();
          }
        }

        if (event.key === "Escape") {
          event.preventDefault();
          setOpen(dropdown, false);
        }
      });

      dropdown.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
          setOpen(dropdown, false);
          toggle.focus();
        }
      });
    });

    document.addEventListener("click", function (event) {
      if (!event.target.closest("[data-nav-dropdown]")) {
        closeAll();
      }
    });

    document.addEventListener("focusin", function (event) {
      if (!event.target.closest("[data-nav-dropdown]")) {
        closeAll();
      }
    });
  }

  document.querySelectorAll("form[data-track-form]").forEach(function (form) {
    var statusNode = form.querySelector("[data-form-status]");
    form.addEventListener("submit", function (event) {
      if (statusNode) {
        statusNode.classList.remove("error");
        statusNode.style.display = "none";
      }

      trackEvent("form_submit_start", {
        form_name: form.getAttribute("name") || "unknown",
        page_location: window.location.pathname,
      });

      if (!form.checkValidity()) {
        event.preventDefault();
        form.reportValidity();
        if (statusNode) {
          statusNode.textContent = "Please complete all required fields and consent before submitting.";
          statusNode.classList.add("error");
          statusNode.style.display = "block";
        }
        return;
      }

      try {
        localStorage.setItem("bwdl_form_submitted", "1");
      } catch (_err) {
        // Ignore storage access issues.
      }
    });
  });

  if (window.location.pathname.endsWith("/thank-you.html") || window.location.pathname === "/thank-you") {
    try {
      if (localStorage.getItem("bwdl_form_submitted") === "1") {
        trackEvent("form_submit_success", {
          page_location: window.location.pathname,
        });
        localStorage.removeItem("bwdl_form_submitted");
      }
    } catch (_err) {
      // Ignore storage access issues.
    }
  }

  bindNavDropdowns();
})();
