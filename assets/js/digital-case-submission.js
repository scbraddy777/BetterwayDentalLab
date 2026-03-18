(function () {
  var form = document.getElementById("digitalCaseForm");
  if (!form) {
    return;
  }

  var reviewBtn = document.getElementById("reviewRxBtn");
  var submitBtn = document.getElementById("submitRxBtn");
  var reviewPanel = document.getElementById("reviewPanel");
  var reviewSummary = document.getElementById("reviewSummary");
  var statusNode = form.querySelector("[data-form-status]");
  var STORAGE_KEY = "bwdl_digital_rx_draft_v1";
  var formName = form.getAttribute("name") || "digital-case-submission";

  var allowedCheckbox = {
    restoration_type: ["Crown", "Bridge"],
    material_selection: [
      "Full Contour Zirconia",
      "Layered Zirconia",
      "Full Lithium Disilicate",
      "Layered Lithium Disilicate"
    ],
    occlusal_contact: ["In Occlusion", "Light Occlusion", "Out 0.3 mm", "Out 0.5 mm"],
    interproximal_pressure: ["Normal", "Broad/Tight"],
    implant_abutment: ["Custom Titanium Abutment", "Custom Zirconia Abutment", "Anodized"],
    implant_crown_type: ["Screw Retained", "Cement Retained"]
  };

  function normalizeArray(values, allowed) {
    return values.filter(function (value) {
      return allowed.indexOf(value) !== -1;
    });
  }

  function getCheckedValues(name) {
    return Array.from(form.querySelectorAll('input[name="' + name + '"]:checked')).map(function (node) {
      return node.value;
    });
  }

  function val(name) {
    var node = form.elements[name];
    if (!node) {
      return "";
    }
    return String(node.value || "").trim();
  }

  function bool(name) {
    var node = form.elements[name];
    return !!(node && node.checked);
  }

  function gatherRxData() {
    var pontic = [];
    for (var i = 1; i <= 5; i += 1) {
      pontic.push({
        position: i,
        checked: bool("pontic_checked_" + i)
      });
    }

    return {
      provider_office_info: {
        dr: val("dr_name"),
        office_phone: val("office_phone"),
        address: val("office_address"),
        due_date: val("due_date")
      },
      patient_case_info: {
        patient_last: val("patient_last"),
        patient_first: val("patient_first"),
        case_number: val("case_number"),
        office_use_only: val("office_use_only")
      },
      restoration_type: normalizeArray(getCheckedValues("restoration_type"), allowedCheckbox.restoration_type),
      material_selection: normalizeArray(getCheckedValues("material_selection"), allowedCheckbox.material_selection),
      tooth_shade: {
        shade: val("shade"),
        tooth_numbers: val("tooth_numbers")
      },
      occlusal_contact: normalizeArray(getCheckedValues("occlusal_contact"), allowedCheckbox.occlusal_contact),
      pontic_design: pontic,
      interproximal_pressure: normalizeArray(getCheckedValues("interproximal_pressure"), allowedCheckbox.interproximal_pressure),
      implants: {
        indicate_implant_system: val("implant_system"),
        implant_platform: {
          size: val("implant_platform_size"),
          length: val("implant_platform_length")
        }
      },
      implant_abutment: normalizeArray(getCheckedValues("implant_abutment"), allowedCheckbox.implant_abutment),
      implant_crown_type: normalizeArray(getCheckedValues("implant_crown_type"), allowedCheckbox.implant_crown_type),
      notes: val("notes"),
      signoff: {
        dr_signature: val("dr_signature"),
        assistant: val("assistant")
      }
    };
  }

  function textLine(label, value) {
    return "<p><strong>" + escapeHtml(label) + "</strong> " + escapeHtml(value || "-") + "</p>";
  }

  function arrayLine(label, items) {
    return "<p><strong>" + escapeHtml(label) + "</strong> " + escapeHtml(items && items.length ? items.join(", ") : "-") + "</p>";
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderReview(data) {
    if (!reviewPanel || !reviewSummary) {
      return;
    }

    var ponticLines = data.pontic_design.map(function (item) {
      return "Position " + item.position + ": " + (item.checked ? "Checked" : "Not Checked");
    });

    reviewSummary.innerHTML = [
      '<div class="rx-review-group"><h4>Provider / Office info</h4>' +
        textLine("Dr.", data.provider_office_info.dr) +
        textLine("Office Phone:", data.provider_office_info.office_phone) +
        textLine("Address:", data.provider_office_info.address) +
        textLine("Due Date:", data.provider_office_info.due_date) +
      "</div>",
      '<div class="rx-review-group"><h4>Patient / Case info</h4>' +
        textLine("Patient (Last)", data.patient_case_info.patient_last) +
        textLine("Patient (First)", data.patient_case_info.patient_first) +
        textLine("Case #:", data.patient_case_info.case_number) +
        textLine("Office Use Only:", data.patient_case_info.office_use_only) +
      "</div>",
      '<div class="rx-review-group"><h4>Restoration + Material</h4>' +
        arrayLine("Restoration Type", data.restoration_type) +
        arrayLine("Material selection", data.material_selection) +
        textLine("Shade", data.tooth_shade.shade) +
        textLine("Tooth #(s)", data.tooth_shade.tooth_numbers) +
      "</div>",
      '<div class="rx-review-group"><h4>Occlusal / Pontic / Interproximal</h4>' +
        arrayLine("Occlusal Contact", data.occlusal_contact) +
        arrayLine("Pontic Design", ponticLines) +
        arrayLine("Interproximal Pressure", data.interproximal_pressure) +
      "</div>",
      '<div class="rx-review-group"><h4>Implants</h4>' +
        textLine("Indicate Implant System:", data.implants.indicate_implant_system) +
        textLine("Implant Platform: Size", data.implants.implant_platform.size) +
        textLine("Implant Platform: Length", data.implants.implant_platform.length) +
        arrayLine("Implant Abutment", data.implant_abutment) +
        arrayLine("Implant Crown Type", data.implant_crown_type) +
      "</div>",
      '<div class="rx-review-group"><h4>Notes + Signoff</h4>' +
        textLine("NOTES:", data.notes) +
        textLine("Dr. Signature:", data.signoff.dr_signature) +
        textLine("Assistant:", data.signoff.assistant) +
      "</div>"
    ].join("");

    reviewPanel.hidden = false;
    if (submitBtn) {
      submitBtn.disabled = false;
    }
  }

  function setStatus(text, isError) {
    if (!statusNode) {
      return;
    }
    statusNode.textContent = text;
    statusNode.classList.toggle("error", !!isError);
    statusNode.style.display = "block";
  }

  function trackEvent(name, params) {
    if (typeof window.gtag === "function") {
      window.gtag("event", name, params || {});
    }
  }

  function safeReturnUrl(url) {
    if (!url || typeof url !== "string" || !url.startsWith("/") || url.startsWith("//")) {
      return "/case-submission.html";
    }
    return url;
  }

  function generateCaseId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID().replace(/-/g, "");
    }
    return "case" + Date.now() + Math.floor(Math.random() * 100000);
  }

  async function getJwt() {
    if (window.BWDLAuth && typeof window.BWDLAuth.getJwt === "function") {
      return window.BWDLAuth.getJwt();
    }
    if (window.netlifyIdentity && typeof window.netlifyIdentity.currentUser === "function") {
      var user = window.netlifyIdentity.currentUser();
      if (user && typeof user.jwt === "function") {
        return user.jwt(true);
      }
    }
    return null;
  }

  function saveDraft() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(gatherRxData()));
    } catch (_err) {
      // Ignore storage errors.
    }
  }

  function restoreDraft() {
    var raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (_err) {
      return;
    }

    if (!raw) {
      return;
    }

    var data;
    try {
      data = JSON.parse(raw);
    } catch (_err) {
      return;
    }

    var map = {
      dr_name: data.provider_office_info && data.provider_office_info.dr,
      office_phone: data.provider_office_info && data.provider_office_info.office_phone,
      office_address: data.provider_office_info && data.provider_office_info.address,
      due_date: data.provider_office_info && data.provider_office_info.due_date,
      patient_last: data.patient_case_info && data.patient_case_info.patient_last,
      patient_first: data.patient_case_info && data.patient_case_info.patient_first,
      case_number: data.patient_case_info && data.patient_case_info.case_number,
      office_use_only: data.patient_case_info && data.patient_case_info.office_use_only,
      shade: data.tooth_shade && data.tooth_shade.shade,
      tooth_numbers: data.tooth_shade && data.tooth_shade.tooth_numbers,
      implant_system: data.implants && data.implants.indicate_implant_system,
      implant_platform_size: data.implants && data.implants.implant_platform && data.implants.implant_platform.size,
      implant_platform_length: data.implants && data.implants.implant_platform && data.implants.implant_platform.length,
      notes: data.notes,
      dr_signature: data.signoff && data.signoff.dr_signature,
      assistant: data.signoff && data.signoff.assistant
    };

    Object.keys(map).forEach(function (name) {
      if (form.elements[name] && typeof map[name] === "string") {
        form.elements[name].value = map[name];
      }
    });

    ["restoration_type", "material_selection", "occlusal_contact", "interproximal_pressure", "implant_abutment", "implant_crown_type"].forEach(function (groupName) {
      var selected = Array.isArray(data[groupName]) ? data[groupName] : [];
      form.querySelectorAll('input[name="' + groupName + '"]').forEach(function (input) {
        input.checked = selected.indexOf(input.value) !== -1;
      });
    });

    if (Array.isArray(data.pontic_design)) {
      data.pontic_design.forEach(function (item, idx) {
        var pos = idx + 1;
        if (form.elements["pontic_checked_" + pos]) {
          form.elements["pontic_checked_" + pos].checked = !!item.checked;
        }
      });
    }
  }

  function enforcePonticImageLayout() {
    var items = form.querySelectorAll(".pontic-grid .pontic-item");
    if (!items.length) {
      return;
    }

    items.forEach(function (item, index) {
      var position = index + 1;

      // Remove any legacy controls/graphics from prior versions.
      item.querySelectorAll("select, svg").forEach(function (node) {
        node.remove();
      });

      var img = item.querySelector("img.pontic-icon");
      if (!img) {
        img = document.createElement("img");
        img.className = "pontic-icon";
        item.insertBefore(img, item.firstChild);
      }

      img.src = "/assets/images/pontic-" + position + ".png";
      img.alt = "Pontic Design option " + position;
    });
  }

  function normalizePonticIcons() {
    var icons = form.querySelectorAll(".pontic-icon");
    if (!icons.length) {
      return;
    }

    function processIcon(img) {
      var w = img.naturalWidth;
      var h = img.naturalHeight;
      if (!w || !h) {
        return;
      }

      var srcCanvas = document.createElement("canvas");
      srcCanvas.width = w;
      srcCanvas.height = h;
      var srcCtx = srcCanvas.getContext("2d");
      if (!srcCtx) {
        return;
      }

      srcCtx.drawImage(img, 0, 0, w, h);
      var imageData = srcCtx.getImageData(0, 0, w, h);
      var data = imageData.data;

      // Estimate background from corner samples, then detect foreground by color distance.
      var corners = [
        [0, 0],
        [w - 1, 0],
        [0, h - 1],
        [w - 1, h - 1]
      ];
      var bg = { r: 0, g: 0, b: 0, a: 0 };
      corners.forEach(function (pt) {
        var idx = (pt[1] * w + pt[0]) * 4;
        bg.r += data[idx];
        bg.g += data[idx + 1];
        bg.b += data[idx + 2];
        bg.a += data[idx + 3];
      });
      bg.r /= corners.length;
      bg.g /= corners.length;
      bg.b /= corners.length;
      bg.a /= corners.length;

      var minX = w;
      var minY = h;
      var maxX = -1;
      var maxY = -1;
      var threshold = 24;

      for (var y = 0; y < h; y += 1) {
        for (var x = 0; x < w; x += 1) {
          var i = (y * w + x) * 4;
          var r = data[i];
          var g = data[i + 1];
          var b = data[i + 2];
          var a = data[i + 3];

          if (a < 10) {
            continue;
          }

          var dist = Math.abs(r - bg.r) + Math.abs(g - bg.g) + Math.abs(b - bg.b);
          if (dist <= threshold) {
            continue;
          }

          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }

      if (maxX < minX || maxY < minY) {
        return;
      }

      var cropW = maxX - minX + 1;
      var cropH = maxY - minY + 1;
      var side = Math.max(cropW, cropH);
      var pad = Math.round(side * 0.12);
      var outSide = side + pad * 2;

      var outCanvas = document.createElement("canvas");
      outCanvas.width = outSide;
      outCanvas.height = outSide;
      var outCtx = outCanvas.getContext("2d");
      if (!outCtx) {
        return;
      }

      outCtx.clearRect(0, 0, outSide, outSide);
      var dx = Math.round((outSide - cropW) / 2);
      var dy = Math.round((outSide - cropH) / 2);
      outCtx.drawImage(srcCanvas, minX, minY, cropW, cropH, dx, dy, cropW, cropH);

      img.src = outCanvas.toDataURL("image/png");
    }

    icons.forEach(function (img) {
      if (img.complete) {
        processIcon(img);
      } else {
        img.addEventListener("load", function () {
          processIcon(img);
        }, { once: true });
      }
    });
  }

  if (reviewBtn) {
    reviewBtn.addEventListener("click", function () {
      renderReview(gatherRxData());
      saveDraft();
    });
  }

  form.addEventListener("input", saveDraft);
  form.addEventListener("change", saveDraft);

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (statusNode) {
      statusNode.style.display = "none";
      statusNode.classList.remove("error");
    }

    trackEvent("form_submit_start", {
      form_name: formName,
      page_location: window.location.pathname,
    });

    var data = gatherRxData();
    if (reviewPanel && reviewPanel.hidden) {
      renderReview(data);
      setStatus("Review your Digital RX, then submit again.", false);
      return;
    }

    var token = await getJwt();
    if (!token) {
      var returnUrl = encodeURIComponent(safeReturnUrl(window.location.pathname + window.location.search));
      var message = encodeURIComponent("Please create an account or log in to submit a case.");
      window.location.href = "/account.html?action=login&returnTo=" + returnUrl + "&message=" + message;
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
    }

    try {
      var response = await fetch("/.netlify/functions/submit-case", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        },
        body: JSON.stringify({
          caseId: generateCaseId(),
          rxSlip: data
        })
      });

      if (!response.ok) {
        var errorMsg = "Unable to submit your digital case right now. Please try again.";
        try {
          var parsed = await response.json();
          if (parsed && parsed.error) {
            errorMsg = parsed.error;
          }
        } catch (_err) {
          // ignore parse errors
        }
        setStatus(errorMsg, true);
        return;
      }

      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (_err) {
        // Ignore storage errors.
      }

      trackEvent("form_submit_success", {
        form_name: formName,
        page_location: window.location.pathname,
      });

      window.location.href = "/thank-you.html";
    } catch (_err) {
      setStatus("Unexpected submission error. Please try again.", true);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
      }
    }
  });

  restoreDraft();
  enforcePonticImageLayout();
  normalizePonticIcons();
})();
