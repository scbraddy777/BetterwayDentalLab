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

  function copyTextToClipboard(value) {
    if (!value) {
      return Promise.reject(new Error("No value to copy."));
    }

    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(value);
    }

    return new Promise(function (resolve, reject) {
      var textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      textarea.style.pointerEvents = "none";
      document.body.appendChild(textarea);
      textarea.select();

      try {
        var copied = document.execCommand("copy");
        document.body.removeChild(textarea);
        if (copied) {
          resolve();
        } else {
          reject(new Error("Clipboard copy failed."));
        }
      } catch (error) {
        document.body.removeChild(textarea);
        reject(error);
      }
    });
  }

  if (page === "connect") {
    var connectFeedback = document.querySelector(".connect-feedback");
    var isDesktopLike = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    function setConnectFeedback(message) {
      if (!connectFeedback) {
        return;
      }
      connectFeedback.hidden = false;
      connectFeedback.textContent = message;
    }

    document.querySelectorAll("[data-copy-phone]").forEach(function (link) {
      link.addEventListener("click", function (event) {
        if (!isDesktopLike) {
          return;
        }

        event.preventDefault();
        var phone = link.getAttribute("data-copy-phone") || (link.getAttribute("href") || "").replace(/^tel:/i, "");

        copyTextToClipboard(phone)
          .then(function () {
            setConnectFeedback("Phone number copied. Use your mobile device to place the call.");
          })
          .catch(function () {
            setConnectFeedback("Phone number: " + phone);
          });
      });
    });
  }

  function bindScannerSelectors() {
    var selectors = document.querySelectorAll("[data-scanner-selector]");

    if (!selectors.length) {
      return;
    }

    selectors.forEach(function (selector) {
      var tabs = Array.prototype.slice.call(selector.querySelectorAll("[data-scanner-tab]"));
      var panels = Array.prototype.slice.call(selector.querySelectorAll("[data-scanner-panel]"));

      if (!tabs.length || !panels.length) {
        return;
      }

      function activate(panelId) {
        tabs.forEach(function (tab) {
          var isActive = tab.getAttribute("data-scanner-tab") === panelId;
          tab.classList.toggle("is-active", isActive);
          tab.setAttribute("aria-pressed", isActive ? "true" : "false");
        });

        panels.forEach(function (panel) {
          var isActive = panel.id === panelId;
          panel.hidden = !isActive;
          panel.classList.toggle("is-active", isActive);
        });
      }

      tabs.forEach(function (tab) {
        tab.addEventListener("click", function () {
          activate(tab.getAttribute("data-scanner-tab"));
        });
      });

      activate(tabs[0].getAttribute("data-scanner-tab"));
    });
  }

  bindScannerSelectors();

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

  if (
    window.location.pathname.endsWith("/thank-you.html") ||
    window.location.pathname === "/thank-you" ||
    window.location.pathname.endsWith("/case-feedback-thank-you.html") ||
    window.location.pathname === "/case-feedback-thank-you"
  ) {
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
