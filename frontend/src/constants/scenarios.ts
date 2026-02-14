export const SCENARIOS = {
  CARDIAC_ARREST: {
    title: "CODE 4 // CARDIAC ARREST",
    isRedAlert: true,
    vitals: { hr: 0, bp: { sys: 0, dia: 0 }, spO2: 70 },
    dispatch: "UNIT 992: PATIENT UNRESPONSIVE. NO PULSE. CPR IN PROGRESS.",
    aiPrompt: "Confirmed Cardiac Arrest. Recommend immediate LUCAS deployment and ACLS protocol.",
    location: { lat: 43.87, lng: -79.44 } // Near Mackenzie Health
  },
  TRAUMA_MVA: {
    title: "CODE 3 // MAJOR TRAUMA",
    isRedAlert: true,
    vitals: { hr: 135, bp: { sys: 85, dia: 50 }, spO2: 88 },
    dispatch: "UNIT 992: MVA AT MAJOR MAC/404. MULTIPLE VICTIMS. HEMORRHAGIC SHOCK.",
    aiPrompt: "Blunt force trauma detected. Initiate rapid fluid bolus and request level 1 trauma center bypass.",
    location: { lat: 43.85, lng: -79.33 }
  },
  ROUTINE: {
    title: "ROUTINE PATROL",
    isRedAlert: false,
    vitals: { hr: 72, bp: { sys: 120, dia: 80 }, spO2: 99 },
    dispatch: "UNIT 992: RESUME ROUTINE PATROL. ALL SYSTEMS GREEN.",
    aiPrompt: "System idling. Standing by for triage.",
    location: { lat: 43.65, lng: -79.38 }
  }
};