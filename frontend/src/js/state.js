/**
 * AURA Reactive Application State Manager.
 * Preserves backend WebSocket contracts, handles multi-tab navigation,
 * persists settings, sound history, and theme preferences to LocalStorage.
 */

class AppState {
  constructor() {
    this.listeners = new Set();

    // Default configuration with LocalStorage persistence
    const savedSettings = this._loadSettings();
    const savedHistory = this._loadHistory();
    const savedTheme = localStorage.getItem("aura_theme") || "light";

    this.state = {
      // Navigation Tab: "home" | "history" | "settings"
      currentTab: "home",
      theme: savedTheme,
      highContrast: false,
      fontScaling: "default",

      // Network & Hardware Status
      connectionStatus: "connecting", // "connected" | "connecting" | "offline"
      audioState: "16kHz_idle",        // "16kHz_idle" | "48kHz_active"
      isListening: false,
      rms: 0.0,
      dbSpl: 42.0,                     // Matches initial Stitch badge (42 dB)

      // Threat & Danger Engine State
      dangerScore: 82.0,
      dangerLevel: "DANGER",           // "SAFE" | "AWARE" | "CAUTION" | "DANGER"
      dangerColor: "#C5221F",
      threatStatusText: "High Hazard Active",
      dangerFactors: {
        type_score: 95,
        intensity_score: 85,
        approach_score: 80,
        context_score: 50,
        delta_db_per_sec: 2.5
      },
      noiseDose: 0.0,

      // Active Critical Alert (Matches Stitch Screen 1)
      criticalAlert: {
        id: "alert-init-fire",
        class_name: "Fire alarm",
        display_name: "Fire Alarm Detected",
        description: "Continuous high-frequency alarm pattern detected.",
        priority: "P0",
        relative_origin: "Behind you (South-Southwest)",
        angle_deg: 195,
        compass_zone: "SSW",
        confidence: 0.94,
        db_spl: 88,
        time_ago: "2s ago",
        timestamp: Date.now() / 1000
      },

      // 360° Directional Compass
      compass: {
        angle_deg: 195,
        compass_zone: "SSW",
        relative_heading: "BEHIND YOU",
        sub_heading: "195° SSW",
        estimated_distance: "8–12 meters",
        line_of_sight: "Indoor Line-of-Sight"
      },

      // Recent Sounds Feed (displayed on Home screen)
      recentSounds: [
        {
          id: "rc-1",
          class_name: "Doorbell",
          display_name: "Doorbell Chime",
          tier: "CAUTION",
          submeta: "Front Door · 4m away · 3m ago",
          arrow: "↗",
          icon: "doorbell",
          angle_deg: 10,
          db_spl: 64
        },
        {
          id: "rc-2",
          class_name: "Dog",
          display_name: "Dog Barking",
          tier: "NOTICE",
          submeta: "Left Window · 6m away · 12m ago",
          arrow: "←",
          icon: "paw",
          angle_deg: 280,
          db_spl: 72
        },
        {
          id: "rc-3",
          class_name: "Water",
          display_name: "Water Running",
          tier: "INFO",
          submeta: "Kitchen Sink · Steady · 28m ago",
          arrow: "↗",
          icon: "water",
          angle_deg: 85,
          db_spl: 51
        }
      ],

      // Sound History Log (Screen 3 Stitch reference)
      historyFilter: "all", // "all" | "critical" | "caution" | "notice" | "info"
      history: savedHistory,

      // Live Speech Transcript
      transcripts: [],

      // SOS Emergency State
      isSosActive: false,
      sosCountdown: 10,
      sosTimerId: null,

      // Action Guide Modal
      isActionGuideOpen: false,

      // Persistent Settings
      settings: savedSettings
    };

    // Apply saved theme on boot
    document.documentElement.setAttribute("data-theme", savedTheme);
  }

  get() {
    return this.state;
  }

  set(partialState) {
    this.state = { ...this.state, ...partialState };
    this._notify();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  _notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (err) {
        console.error("[State] Listener error:", err);
      }
    }
  }

  switchTab(tabName) {
    if (["home", "history", "settings"].includes(tabName)) {
      this.set({ currentTab: tabName });
    }
  }

  setTheme(themeName) {
    const theme = themeName === "dark" ? "dark" : "light";
    localStorage.setItem("aura_theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
    this.set({ theme });
  }

  dismissAlert() {
    this.set({ criticalAlert: null });
  }

  openActionGuide() {
    this.set({ isActionGuideOpen: true });
  }

  closeActionGuide() {
    this.set({ isActionGuideOpen: false });
  }

  updateSettings(newSettings) {
    this.state.settings = { ...this.state.settings, ...newSettings };
    localStorage.setItem("aura_settings", JSON.stringify(this.state.settings));
    this._notify();
  }

  _loadSettings() {
    try {
      const data = localStorage.getItem("aura_settings");
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn("[State] Could not parse stored settings:", e);
    }
    return {
      thresholdX: 40,               // Default 40 dB Minimum Audio Threshold
      visualIntensity: "standard",   // "subtle" | "standard" | "strobe"
      hapticsEnabled: true,
      vibrationForce: "strong",      // "light" | "medium" | "strong"
      showDirection360: true,
      language: "en-US",
      highContrast: false,
      screenFlash: true,
      fontScaling: "default",
      alertLibrary: {
        smoke_alarms: true,
        sirens_horns: true,
        doorbells_knocking: true,
        baby_crying: true,
        appliance_beeps: true,
        ambient_background: false
      },
      emergencyContacts: [
        { id: 1, name: "Sarah Jenkins", role: "Daughter", phone: "+1 (555) 019-2834", initials: "SJ" },
        { id: 2, name: "Dr. Robert Vance", role: "Audiologist", phone: "+1 (555) 014-8821", initials: "RV" }
      ]
    };
  }

  _loadHistory() {
    try {
      const data = localStorage.getItem("aura_sound_history");
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn("[State] Could not parse stored history:", e);
    }
    // Default seed events from Stitch Screen 3
    return [
      {
        id: "ev-1",
        dateGroup: "TODAY",
        dateLabel: "TODAY — OCT 24",
        class_name: "Fire alarm",
        display_name: "Fire Alarm (Continuous)",
        tier: "CRITICAL",
        categoryType: "critical",
        timestampStr: "09:41 AM · Indoor Alarm Sensor",
        directionStr: "195° SSW",
        dbStr: "88 dB High",
        confStr: "94%",
        icon: "alarm",
        hasGuide: true
      },
      {
        id: "ev-2",
        dateGroup: "TODAY",
        dateLabel: "TODAY — OCT 24",
        class_name: "Doorbell",
        display_name: "Doorbell Chime",
        tier: "CAUTION",
        categoryType: "caution",
        timestampStr: "09:12 AM · Front Entryway",
        directionStr: "Front Door (010° N)",
        dbStr: "64 dB Moderate",
        confStr: "89%",
        icon: "doorbell"
      },
      {
        id: "ev-3",
        dateGroup: "TODAY",
        dateLabel: "TODAY — OCT 24",
        class_name: "Dog",
        display_name: "Dog Barking (Repetitive)",
        tier: "AWARE",
        categoryType: "notice",
        timestampStr: "08:35 AM · Living Area",
        directionStr: "Left side (280° W)",
        dbStr: "72 dB Moderate",
        confStr: "92%",
        icon: "paw"
      },
      {
        id: "ev-4",
        dateGroup: "TODAY",
        dateLabel: "TODAY — OCT 24",
        class_name: "Water",
        display_name: "Kitchen Water Running",
        tier: "INFO",
        categoryType: "info",
        timestampStr: "08:05 AM · Continuous Flow (3m)",
        directionStr: "Kitchen (085° E)",
        dbStr: "51 dB Calm",
        confStr: "86%",
        icon: "water"
      },
      {
        id: "ev-5",
        dateGroup: "TODAY",
        dateLabel: "TODAY — OCT 24",
        class_name: "Microwave",
        display_name: "Microwave Timer Beep",
        tier: "AWARE",
        categoryType: "notice",
        timestampStr: "07:45 AM · Single Alert",
        directionStr: "Indoors (Ambient)",
        dbStr: "58 dB Normal",
        confStr: "90%",
        icon: "timer"
      },
      {
        id: "ev-6",
        dateGroup: "YESTERDAY",
        dateLabel: "YESTERDAY — OCT 23",
        class_name: "Car horn",
        display_name: "Car Horn Honking",
        tier: "CAUTION",
        categoryType: "caution",
        timestampStr: "05:22 PM · Street Traffic",
        directionStr: "Outside window (340° NNW)",
        dbStr: "82 dB High",
        confStr: "95%",
        icon: "car"
      },
      {
        id: "ev-7",
        dateGroup: "YESTERDAY",
        dateLabel: "YESTERDAY — OCT 23",
        class_name: "Speech",
        display_name: "Speech / Conversation...",
        tier: "INFO",
        categoryType: "info",
        timestampStr: "02:15 PM · Human Voice",
        directionStr: "Right (090° E)",
        dbStr: "60 dB Moderate",
        confStr: "91%",
        icon: "speech"
      },
      {
        id: "ev-8",
        dateGroup: "YESTERDAY",
        dateLabel: "YESTERDAY — OCT 23",
        class_name: "Knock",
        display_name: "Knocking at Door",
        tier: "AWARE",
        categoryType: "notice",
        timestampStr: "11:30 AM · Wood Surface",
        directionStr: "Front Door (015° NNE)",
        dbStr: "68 dB Moderate",
        confStr: "87%",
        icon: "knock"
      }
    ];
  }

  addSoundEvent(event) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const angle = Math.round(event.angle_deg || 0);
    const zone = event.compass_zone || "N";
    const db = Math.round(event.db_spl || 65);
    const conf = Math.round((event.confidence || 0.85) * 100);

    // Map Priority to Tier
    let tier = "INFO";
    let catType = "info";
    if (event.priority === "P0") {
      tier = "CRITICAL";
      catType = "critical";
    } else if (event.priority === "P1") {
      tier = "CAUTION";
      catType = "caution";
    } else if (event.priority === "P2") {
      tier = "AWARE";
      catType = "notice";
    }

    // Determine navigation heading (0° = North, 90° = East, 180° = South, 270° = West)
    const rawAngle = typeof event.angle_deg === "number" ? event.angle_deg : 90;
    let navAngle = Math.round(rawAngle);
    if (zone === "OMNI") {
      navAngle = 0;
    } else if (zone === "N" && Math.abs(rawAngle - 90) < 15) {
      navAngle = 0;
    } else if (zone === "E" && (Math.abs(rawAngle) < 25 || Math.abs(rawAngle - 360) < 25)) {
      navAngle = 90;
    } else if (zone === "W" && Math.abs(rawAngle - 180) < 25) {
      navAngle = 270;
    } else if (zone === "S" && Math.abs(rawAngle - 270) < 25) {
      navAngle = 180;
    } else if (zone === "NE" && Math.abs(rawAngle - 45) < 30) {
      navAngle = 45;
    } else if (zone === "NW" && Math.abs(rawAngle - 135) < 30) {
      navAngle = 315;
    } else if (zone === "SE" && Math.abs(rawAngle - 315) < 30) {
      navAngle = 135;
    } else if (zone === "SW" && Math.abs(rawAngle - 225) < 30) {
      navAngle = 225;
    } else if (zone === "SSW" || (rawAngle >= 190 && rawAngle <= 210)) {
      navAngle = 195;
    } else {
      // General polar to navigation: (90 - theta) mod 360
      navAngle = Math.round(((90 - rawAngle) % 360 + 360) % 360);
    }

    // Determine relative heading description
    let relHeading = "AHEAD OF YOU";
    let subHeading = `${navAngle}° ${zone}`;
    if (zone === "OMNI") {
      relHeading = "OMNIDIRECTIONAL";
      subHeading = "SURROUND SOUND";
    } else if (navAngle >= 135 && navAngle <= 225) {
      relHeading = "BEHIND YOU";
    } else if (navAngle > 45 && navAngle < 135) {
      relHeading = "TO YOUR RIGHT";
    } else if (navAngle > 225 && navAngle < 315) {
      relHeading = "TO YOUR LEFT";
    } else {
      relHeading = "AHEAD OF YOU";
    }

    // Update Compass State
    const updatedCompass = {
      angle_deg: navAngle,
      compass_zone: zone,
      relative_heading: relHeading,
      sub_heading: subHeading,
      estimated_distance: db > 80 ? "3–5 meters" : db > 65 ? "8–12 meters" : "15–20 meters",
      line_of_sight: "Indoor Line-of-Sight"
    };

    // Construct event item for History
    const historyItem = {
      id: "ev-" + Date.now(),
      dateGroup: "TODAY",
      dateLabel: "TODAY — " + now.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase(),
      class_name: event.class || event.sound_class,
      display_name: event.display_name,
      tier: tier,
      categoryType: catType,
      timestampStr: `${timeStr} · Sensor Detection`,
      directionStr: subHeading,
      dbStr: `${db} dB ${db > 80 ? 'High' : 'Moderate'}`,
      confStr: `${conf}%`,
      icon: this._getIconForClass(event.class || event.sound_class),
      hasGuide: tier === "CRITICAL"
    };

    const newHistory = [historyItem, ...this.state.history].slice(0, 50);
    localStorage.setItem("aura_sound_history", JSON.stringify(newHistory));

    // Update Recent Sounds list on Home
    const recentItem = {
      id: "rc-" + Date.now(),
      class_name: event.class || event.sound_class,
      display_name: event.display_name,
      tier: tier === "CRITICAL" ? "CRITICAL" : tier === "CAUTION" ? "CAUTION" : tier === "AWARE" ? "NOTICE" : "INFO",
      submeta: `Estimated ${updatedCompass.estimated_distance} · Just now`,
      arrow: (navAngle > 180 && navAngle < 360) ? "←" : "↗",
      icon: this._getIconForClass(event.class || event.sound_class),
      angle_deg: navAngle,
      db_spl: db
    };
    const newRecent = [recentItem, ...this.state.recentSounds].slice(0, 5);

    // If Critical/Warning, trigger prominent Critical Alert Card on Home
    let newCriticalAlert = this.state.criticalAlert;
    if (tier === "CRITICAL" || event.priority === "P0" || event.priority === "P1") {
      newCriticalAlert = {
        id: "alert-" + Date.now(),
        class_name: event.class || event.sound_class,
        display_name: (event.display_name || event.class || "Hazard") + " Detected",
        description: `Urgent acoustic pattern detected with ${conf}% confidence.`,
        priority: event.priority,
        relative_origin: `${relHeading.toLowerCase()} (${subHeading})`,
        angle_deg: navAngle,
        compass_zone: zone,
        confidence: event.confidence,
        db_spl: db,
        time_ago: "Just now",
        timestamp: Date.now() / 1000
      };
    }

    this.set({
      compass: updatedCompass,
      recentSounds: newRecent,
      history: newHistory,
      criticalAlert: newCriticalAlert,
      dbSpl: db
    });
  }

  _getIconForClass(className = "") {
    const c = className.toLowerCase();
    if (c.includes("alarm") || c.includes("siren") || c.includes("smoke")) return "alarm";
    if (c.includes("bell") || c.includes("ring")) return "doorbell";
    if (c.includes("dog") || c.includes("bark")) return "paw";
    if (c.includes("water") || c.includes("liquid")) return "water";
    if (c.includes("horn") || c.includes("vehicle") || c.includes("car")) return "car";
    if (c.includes("speech") || c.includes("talk") || c.includes("human")) return "speech";
    if (c.includes("knock")) return "knock";
    return "wave";
  }

  triggerSos(countdown = 10) {
    if (this.state.isSosActive) return;
    this.set({ isSosActive: true, sosCountdown: countdown });
  }

  cancelSos() {
    if (this.state.sosTimerId) {
      clearInterval(this.state.sosTimerId);
    }
    this.set({ isSosActive: false, sosCountdown: 10, sosTimerId: null });
  }
}

export const appState = new AppState();
