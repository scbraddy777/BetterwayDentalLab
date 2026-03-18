(async function () {
  document.documentElement.classList.add("js");

  var body = document.body;
  var page = body.getAttribute("data-page");
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

  function setIdentityWidgetInteractivity(enabled) {
    document.querySelectorAll(".netlify-identity-widget").forEach(function (node) {
      node.style.pointerEvents = enabled ? "" : "none";
    });
  }

  function releaseIdentityUiLocks() {
    if (page === "account") {
      return;
    }

    setIdentityWidgetInteractivity(false);
    if (body) {
      body.style.overflow = "";
      body.style.paddingRight = "";
    }
    document.documentElement.style.overflow = "";
    document.documentElement.style.paddingRight = "";
  }

  document.querySelectorAll("[data-event]").forEach(function (node) {
    node.addEventListener("click", function () {
      var eventName = node.getAttribute("data-event");
      if (eventName) {
        trackEvent(eventName, {
          page_location: window.location.pathname,
          cta_text: (node.textContent || "").trim().slice(0, 60),
        });
      }
    });
  });

  function bindHeaderLoginLinks() {
    var loginLinks = document.querySelectorAll("[data-auth-login='true']");
    if (!loginLinks.length) {
      return;
    }

    var returnUrl = window.location.pathname + window.location.search;
    var loginHref = "/account.html?action=login&returnTo=" + encodeURIComponent(returnUrl);
    var accountHref = "/account.html";
    var authenticated = false;

    function updateHeaderAuthButton(user) {
      authenticated = !!user;
      loginLinks.forEach(function (link) {
        if (authenticated) {
          link.textContent = "Account";
          link.href = accountHref;
          return;
        }
        link.textContent = "Log in";
        link.href = loginHref;
      });
    }

    loginLinks.forEach(function (link) {
      link.href = loginHref;
      link.addEventListener("click", function (event) {
        if (authenticated) {
          event.preventDefault();
          window.location.href = accountHref;
          return;
        }
        event.preventDefault();
        var fallbackTimer = window.setTimeout(function () {
          window.location.href = loginHref;
        }, 1200);
        try {
          initAuth().then(function (identity) {
            window.clearTimeout(fallbackTimer);
            if (identity && typeof identity.open === "function") {
              setIdentityWidgetInteractivity(true);
              identity.open("login");
              return;
            }
            window.location.href = loginHref;
          }).catch(function () {
            window.clearTimeout(fallbackTimer);
            window.location.href = loginHref;
          });
        } catch (_err) {
          window.clearTimeout(fallbackTimer);
          window.location.href = loginHref;
        }
      });
    });

    initAuth().then(function (identity) {
      updateHeaderAuthButton(currentUser());
      releaseIdentityUiLocks();
      identity.on("init", function (user) {
        updateHeaderAuthButton(user);
        releaseIdentityUiLocks();
      });
      identity.on("login", function (user) {
        updateHeaderAuthButton(user);
        releaseIdentityUiLocks();
      });
      identity.on("logout", function () {
        updateHeaderAuthButton(null);
        releaseIdentityUiLocks();
      });
    }).catch(function () {
      updateHeaderAuthButton(null);
      releaseIdentityUiLocks();
    });
  }

  function prewarmIdentityForHeaderLogin() {
    if (!document.querySelector("[data-auth-login='true']")) {
      return;
    }
    try {
      ensureIdentityWidget();
    } catch (_err) {
      // Ignore prewarm failures; click handler still has fallback logic.
    }
  }

  function getQueryParam(name) {
    var params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  function safeReturnUrl(url) {
    if (!url || typeof url !== "string") {
      return "/case-submission.html";
    }
    if (!url.startsWith("/") || url.startsWith("//")) {
      return "/case-submission.html";
    }
    return url;
  }

  function accountLoginHref(returnTo, message) {
    var target = safeReturnUrl(returnTo || window.location.pathname + window.location.search);
    var href = "/account.html?action=login&returnTo=" + encodeURIComponent(target);
    if (message) {
      href += "&message=" + encodeURIComponent(message);
    }
    return href;
  }

  var identityLoadPromise;
  function ensureIdentityWidget() {
    if (window.netlifyIdentity) {
      return Promise.resolve(window.netlifyIdentity);
    }

    if (identityLoadPromise) {
      return identityLoadPromise;
    }

    identityLoadPromise = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = "https://identity.netlify.com/v1/netlify-identity-widget.js";
      script.async = true;
      script.onload = function () {
        if (!window.netlifyIdentity) {
          reject(new Error("Identity widget failed to initialize."));
          return;
        }
        resolve(window.netlifyIdentity);
      };
      script.onerror = function () {
        reject(new Error("Unable to load Netlify Identity."));
      };
      document.head.appendChild(script);
    });

    return identityLoadPromise;
  }

  var authInitialized = false;
  async function initAuth() {
    var identity = await ensureIdentityWidget();
    if (!authInitialized) {
      identity.init();
      authInitialized = true;
    }
    return identity;
  }

  function currentUser() {
    if (!window.netlifyIdentity || typeof window.netlifyIdentity.currentUser !== "function") {
      return null;
    }
    return window.netlifyIdentity.currentUser();
  }

  async function resolveCurrentUser(identity) {
    var user = currentUser();
    if (user) {
      return user;
    }

    return new Promise(function (resolve) {
      var settled = false;

      function finish(nextUser) {
        if (settled) {
          return;
        }
        settled = true;
        resolve(nextUser || currentUser());
      }

      var timer = window.setTimeout(function () {
        finish(currentUser());
      }, 1200);

      if (!identity || typeof identity.on !== "function") {
        window.clearTimeout(timer);
        finish(currentUser());
        return;
      }

      identity.on("init", function (initUser) {
        window.clearTimeout(timer);
        finish(initUser);
      });
    });
  }

  async function getJwt() {
    var identity = await initAuth();
    var user = await resolveCurrentUser(identity);
    if (!user || typeof user.jwt !== "function") {
      return null;
    }
    return user.jwt(true);
  }

  function redirectToAccount(message) {
    window.location.href = accountLoginHref(
      window.location.pathname + window.location.search,
      message || "Please create an account or log in to submit a case."
    );
  }

  function bindProtectedCaseSubmissionLinks() {
    var protectedLinks = document.querySelectorAll(
      ".site-header a[href='/case-submission.html'], .site-header a[href='/case-submission'], .site-header a[href='/submit-case']"
    );
    if (!protectedLinks.length) {
      return;
    }

    protectedLinks.forEach(function (link) {
      link.addEventListener("click", function (event) {
        var targetPath = safeReturnUrl(link.getAttribute("href") || "/case-submission.html");
        event.preventDefault();
        if (currentUser()) {
          window.location.href = targetPath;
          return;
        }
        window.location.href = accountLoginHref(
          targetPath,
          "Please create an account or log in to submit a case."
        );
      });
    });
  }

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

  async function guardCaseSubmissionRoute() {
    if (page !== "case-submission") {
      return;
    }

    try {
      var identity = await initAuth();
      var user = await resolveCurrentUser(identity);
      if (!user) {
        redirectToAccount("Please create an account or log in to submit a case.");
      }
    } catch (_err) {
      redirectToAccount("Please create an account or log in to submit a case.");
    }
  }

  async function initAccountPage() {
    if (page !== "account") {
      return;
    }

    var messageNode = document.getElementById("authMessage");
    var sessionStatusNode = document.getElementById("sessionStatus");
    var sessionEmailNode = document.getElementById("sessionEmail");
    var signupBtn = document.getElementById("signupBtn");
    var loginBtn = document.getElementById("loginBtn");
    var logoutBtn = document.getElementById("logoutBtn");
    var continueBtn = document.getElementById("continueBtn");
    var authAction = String(getQueryParam("action") || "").toLowerCase();

    var returnUrl = safeReturnUrl(
      getQueryParam("returnTo") ||
      getQueryParam("returnUrl") ||
      localStorage.getItem("bwdl_return_url") ||
      "/case-submission.html"
    );
    if (continueBtn) {
      continueBtn.href = returnUrl;
    }

    var queryMessage = getQueryParam("message");
    if (queryMessage && messageNode) {
      messageNode.textContent = queryMessage;
      messageNode.style.display = "block";
    }

    try {
      localStorage.setItem("bwdl_return_url", returnUrl);
    } catch (_err) {
      // Ignore storage access issues.
    }

    try {
      var identity = await initAuth();

      function refreshSessionUi() {
        var user = currentUser();
        if (!sessionStatusNode || !sessionEmailNode || !logoutBtn || !loginBtn || !signupBtn) {
          return;
        }

        if (user && user.email) {
          sessionStatusNode.textContent = "Logged in";
          sessionEmailNode.textContent = user.email;
          logoutBtn.style.display = "inline-flex";
          loginBtn.style.display = "none";
          signupBtn.style.display = "none";

          if (messageNode && !queryMessage) {
            messageNode.textContent = "You are authenticated. You can continue to case submission.";
            messageNode.style.display = "block";
          }
        } else {
          sessionStatusNode.textContent = "Not logged in";
          sessionEmailNode.textContent = "Not logged in";
          logoutBtn.style.display = "none";
          loginBtn.style.display = "inline-flex";
          signupBtn.style.display = "inline-flex";
        }
      }

      refreshSessionUi();

      identity.on("login", function () {
        try {
          identity.close();
        } catch (_err) {
          // Ignore close errors.
        }
        refreshSessionUi();
        var target = safeReturnUrl(localStorage.getItem("bwdl_return_url") || returnUrl);
        window.location.href = target;
      });

      identity.on("signup", function () {
        refreshSessionUi();
        if (messageNode) {
          messageNode.textContent = "Account created. Check your email if confirmation is required, then log in.";
          messageNode.style.display = "block";
        }
      });

      identity.on("logout", function () {
        refreshSessionUi();
        if (messageNode) {
          messageNode.textContent = "You have been logged out.";
          messageNode.style.display = "block";
        }
      });

      if (signupBtn) {
        signupBtn.addEventListener("click", function () {
          identity.open("signup");
        });
      }

      if (loginBtn) {
        loginBtn.addEventListener("click", function () {
          identity.open("login");
        });
      }

      if (logoutBtn) {
        logoutBtn.addEventListener("click", function () {
          identity.logout();
        });
      }

      if (authAction === "logout") {
        if (currentUser()) {
          identity.logout();
        } else if (messageNode && !queryMessage) {
          messageNode.textContent = "You are already logged out.";
          messageNode.style.display = "block";
        }
      } else if (authAction === "signup") {
        if (currentUser()) {
          window.location.href = returnUrl;
        } else {
          identity.open("signup");
        }
      } else if (authAction === "login") {
        if (currentUser()) {
          window.location.href = returnUrl;
        } else {
          identity.open("login");
        }
      }
    } catch (_err) {
      if (messageNode) {
        messageNode.textContent = "Account service unavailable. Please try again later.";
        messageNode.classList.add("error");
        messageNode.style.display = "block";
      }
      if (sessionStatusNode) {
        sessionStatusNode.textContent = "Unavailable";
      }
    }
  }

  var trackedForms = document.querySelectorAll("form[data-track-form]");
  trackedForms.forEach(function (form) {
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

  await guardCaseSubmissionRoute();
  await initAccountPage();
  prewarmIdentityForHeaderLogin();
  bindNavDropdowns();
  bindProtectedCaseSubmissionLinks();
  bindHeaderLoginLinks();
  releaseIdentityUiLocks();
  window.setTimeout(releaseIdentityUiLocks, 250);
  window.addEventListener("pageshow", function () {
    releaseIdentityUiLocks();
  });

  window.BWDLAuth = {
    currentUser: currentUser,
    getJwt: getJwt,
  };
})();
