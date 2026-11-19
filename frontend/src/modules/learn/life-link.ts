import type { LocalizedText } from "@/lib/i18n";

/**
 * Life Link: real-life analogies that tie a textbook concept to something a
 * Tamil Nadu student already knows (the kitchen, the bus, the temple festival).
 *
 * Every analogy says where it breaks down, so it never plants a misconception.
 * A concept can have several analogies in different themes; the student picks
 * the one that clicks. This is seed content for the pilot (mostly Class 10
 * Science) — it moves to the database and the content studio later
 * (docs/learning-portal-plan.md §5), and Tamil wording should be checked by a
 * teacher before wide release.
 */

export const LIFE_LINK_THEMES = ["home", "kitchen", "farm", "sports", "market", "festival", "travel", "school"] as const;
export type LifeLinkTheme = (typeof LIFE_LINK_THEMES)[number];

export const THEME_LABEL: Record<LifeLinkTheme, LocalizedText> = {
  home: { en: "Home", ta: "வீடு" },
  kitchen: { en: "Kitchen", ta: "சமையலறை" },
  farm: { en: "Farm", ta: "வயல்" },
  sports: { en: "Sports", ta: "விளையாட்டு" },
  market: { en: "Market", ta: "சந்தை" },
  festival: { en: "Festival", ta: "திருவிழா" },
  travel: { en: "Travel", ta: "பயணம்" },
  school: { en: "School", ta: "பள்ளி" },
};

export const THEME_EMOJI: Record<LifeLinkTheme, string> = {
  home: "🏠",
  kitchen: "🍳",
  farm: "🌾",
  sports: "🏏",
  market: "🛒",
  festival: "🪔",
  travel: "🚌",
  school: "🏫",
};

export type Analogy = {
  readonly id: string;
  readonly theme: LifeLinkTheme;
  /** The analogy itself: 2–4 short sentences. */
  readonly body: LocalizedText;
  /** Where the comparison stops being true. */
  readonly breaksDown: LocalizedText;
};

export type LifeLinkConcept = {
  readonly id: string;
  /** Chapters this concept appears in (the same idea is often taught in several classes). */
  readonly chapterIds: readonly string[];
  readonly concept: LocalizedText;
  readonly analogies: readonly Analogy[];
};

const ELECTRICITY_CHAPTERS = [
  "c6-science-ch8",
  "c7-science-ch6",
  "c8-science-ch6",
  "c9-science-ch4",
  "c10-science-ch4",
] as const;

const FRACTION_CHAPTERS = ["c4-math-ch5", "c5-math-ch4", "c6-math-ch11", "c7-math-ch8"] as const;

export const LIFE_LINKS: readonly LifeLinkConcept[] = [
  // ---------------------------------------------------------------- Electricity
  {
    id: "ll-current-voltage-resistance",
    chapterIds: ELECTRICITY_CHAPTERS,
    concept: { en: "Current, voltage and resistance", ta: "மின்னோட்டம், மின்னழுத்தம், மின்தடை" },
    analogies: [
      {
        id: "ll-cvr-tank",
        theme: "home",
        body: {
          en: "Think of the overhead water tank on your house. The higher the tank, the harder water pushes down the pipe — that push is voltage. The amount of water flowing out of the tap each second is current. A thin or blocked pipe lets less water through — that is resistance.",
          ta: "உங்கள் வீட்டு மேல்நிலைத் தண்ணீர்த் தொட்டியை நினைத்துப் பாருங்கள். தொட்டி எவ்வளவு உயரத்தில் இருக்கிறதோ, அவ்வளவு வேகமாகக் குழாயில் நீர் தள்ளப்படும் — அந்தத் தள்ளுதலே மின்னழுத்தம். ஒவ்வொரு விநாடியும் குழாயிலிருந்து வெளிவரும் நீரின் அளவே மின்னோட்டம். மெல்லிய அல்லது அடைபட்ட குழாய் குறைவான நீரையே விடும் — அதுவே மின்தடை.",
        },
        breaksDown: {
          en: "Water leaves the pipe and is gone, but electrons never leave the wire — they are already everywhere in the circuit and all start moving together. And a wire does not need to be 'filled up' first.",
          ta: "நீர் குழாயை விட்டு வெளியேறிவிடும்; ஆனால் எலக்ட்ரான்கள் கம்பியை விட்டு வெளியேறுவதில்லை — அவை சுற்று முழுவதும் ஏற்கெனவே இருந்து, ஒரே நேரத்தில் நகரத் தொடங்குகின்றன.",
        },
      },
      {
        id: "ll-cvr-temple-gate",
        theme: "festival",
        body: {
          en: "At a temple festival, a huge crowd squeezes through the gate. The push from the crowd behind is like voltage. The number of people passing through the gate each minute is like current. A narrow gate slows everyone down — that is resistance. Widen the gate (less resistance) or push harder (more voltage), and more people pass each minute (more current).",
          ta: "கோயில் திருவிழாவில் பெருங்கூட்டம் வாயில் வழியே நெருக்கியடித்துச் செல்கிறது. பின்னால் இருந்து கூட்டம் தள்ளுவது மின்னழுத்தம் போன்றது. ஒவ்வொரு நிமிடமும் வாயிலைக் கடக்கும் மக்களின் எண்ணிக்கை மின்னோட்டம் போன்றது. குறுகிய வாயில் எல்லோரையும் மெதுவாக்கும் — அதுவே மின்தடை.",
        },
        breaksDown: {
          en: "People get tired and stop; electrons don't. Also, in a circuit the 'crowd' goes round and round in a closed loop and comes back to the battery.",
          ta: "மக்கள் களைத்து நின்றுவிடுவார்கள்; எலக்ட்ரான்கள் நிற்பதில்லை. மேலும் மின்சுற்றில் 'கூட்டம்' மூடிய பாதையில் சுற்றி மீண்டும் மின்கலத்துக்கே வருகிறது.",
        },
      },
    ],
  },
  {
    id: "ll-joule-heating",
    chapterIds: ["c10-science-ch4", "c8-science-ch6"],
    concept: { en: "Heating effect of current (Joule's law)", ta: "மின்னோட்டத்தின் வெப்ப விளைவு (ஜூல் விதி)" },
    analogies: [
      {
        id: "ll-joule-hands",
        theme: "home",
        body: {
          en: "Rub your palms together fast on a cold morning — they get warm. Electrons pushing through a wire keep bumping into its atoms, and that rubbing turns into heat. More current, more resistance or more time means more heat — which is exactly how an iron box, a water heater and a bulb filament work.",
          ta: "குளிர்ந்த காலையில் உள்ளங்கைகளை வேகமாகத் தேய்த்தால் சூடாகின்றன. கம்பியில் நகரும் எலக்ட்ரான்கள் அதன் அணுக்களில் மோதிக்கொண்டே இருக்கின்றன; அந்த உராய்வு வெப்பமாக மாறுகிறது. மின்னோட்டம், மின்தடை அல்லது நேரம் அதிகமானால் வெப்பமும் அதிகம் — இஸ்திரிப் பெட்டி, நீர் சூடாக்கி, மின்விளக்கு இழை இப்படித்தான் இயங்குகின்றன.",
        },
        breaksDown: {
          en: "Heat from rubbing depends on how hard you press; Joule heating depends on current squared (I²Rt), so doubling the current gives four times the heat.",
          ta: "தேய்த்தலின் வெப்பம் எவ்வளவு அழுத்துகிறோம் என்பதைப் பொறுத்தது; ஜூல் வெப்பம் மின்னோட்டத்தின் இருமடியைப் (I²Rt) பொறுத்தது — மின்னோட்டம் இருமடங்கானால் வெப்பம் நான்கு மடங்காகும்.",
        },
      },
    ],
  },

  // ---------------------------------------------------------------- Motion
  {
    id: "ll-inertia",
    chapterIds: ["c10-science-ch1", "c9-science-ch2", "c6-science-ch2", "c7-science-ch2"],
    concept: { en: "Inertia (Newton's first law)", ta: "நிலைமம் (நியூட்டனின் முதல் விதி)" },
    analogies: [
      {
        id: "ll-inertia-bus",
        theme: "travel",
        body: {
          en: "When a town bus brakes suddenly, standing passengers lurch forward. The bus stopped, but their bodies 'wanted' to keep moving. When the bus starts suddenly, they fall backwards — their bodies wanted to stay still. That tendency to keep doing what you were doing is inertia.",
          ta: "நகரப் பேருந்து திடீரென நிறுத்தும்போது நின்றுகொண்டிருப்பவர்கள் முன்னோக்கிச் சாய்கிறார்கள். பேருந்து நின்றுவிட்டது, ஆனால் அவர்கள் உடல் தொடர்ந்து நகர 'விரும்புகிறது'. பேருந்து திடீரெனப் புறப்படும்போது பின்னோக்கி விழுகிறார்கள் — உடல் அசையாமல் இருக்க விரும்பியது. இருக்கும் நிலையிலேயே தொடரும் இந்தத் தன்மையே நிலைமம்.",
        },
        breaksDown: {
          en: "Nothing actually 'throws' you forward — no force pushes you. You simply keep moving while the bus under you slows down.",
          ta: "உண்மையில் உங்களை எந்த விசையும் முன்னோக்கித் தள்ளவில்லை. உங்களுக்குக் கீழே பேருந்து மெதுவாகும்போது நீங்கள் தொடர்ந்து நகர்கிறீர்கள், அவ்வளவுதான்.",
        },
      },
      {
        id: "ll-inertia-cricket",
        theme: "sports",
        body: {
          en: "A cricket ball rolling on the outfield keeps going until friction from the grass slows it. On a smooth cement pitch it rolls much further. With no friction at all, it would never stop — that is Newton's first law.",
          ta: "மைதானத்தில் உருளும் கிரிக்கெட் பந்து, புல்லின் உராய்வு அதை மெதுவாக்கும் வரை தொடர்ந்து உருள்கிறது. வழுவழுப்பான சிமெண்ட் தரையில் அது இன்னும் தொலைவு செல்லும். உராய்வே இல்லையென்றால் அது நிற்கவே நிற்காது — இதுவே நியூட்டனின் முதல் விதி.",
        },
        breaksDown: {
          en: "On Earth there is always some friction and air resistance, so we never see the 'never stops' part directly.",
          ta: "பூமியில் எப்போதும் சிறிது உராய்வும் காற்றுத் தடையும் உண்டு; எனவே 'நிற்கவே நிற்காது' என்பதை நேரடியாகப் பார்க்க முடியாது.",
        },
      },
    ],
  },
  {
    id: "ll-momentum",
    chapterIds: ["c10-science-ch1", "c9-science-ch2"],
    concept: { en: "Momentum", ta: "உந்தம்" },
    analogies: [
      {
        id: "ll-momentum-lorry",
        theme: "travel",
        body: {
          en: "A bicycle and a loaded sand lorry both come down the road at 20 km/h. Which is harder to stop? The lorry — it has far more mass, so far more momentum (mass × velocity). That is why heavy vehicles need much longer to brake.",
          ta: "ஒரு மிதிவண்டியும் மணல் ஏற்றிய லாரியும் மணிக்கு 20 கி.மீ. வேகத்தில் வருகின்றன. எதை நிறுத்துவது கடினம்? லாரியைத்தான் — அதன் நிறை மிக அதிகம், எனவே உந்தமும் (நிறை × திசைவேகம்) மிக அதிகம். அதனால்தான் கனரக வாகனங்கள் நிற்க அதிக தூரம் தேவைப்படுகிறது.",
        },
        breaksDown: {
          en: "Momentum has a direction too: two equal lorries moving towards each other have a total momentum of zero, even though each one is hard to stop.",
          ta: "உந்தத்துக்குத் திசையும் உண்டு: எதிரெதிரே வரும் இரண்டு சம லாரிகளின் மொத்த உந்தம் சுழி — ஒவ்வொன்றையும் நிறுத்துவது கடினமாக இருந்தாலும் கூட.",
        },
      },
    ],
  },
  {
    id: "ll-third-law",
    chapterIds: ["c10-science-ch1"],
    concept: { en: "Action and reaction (Newton's third law)", ta: "வினை மற்றும் எதிர்வினை (நியூட்டனின் மூன்றாம் விதி)" },
    analogies: [
      {
        id: "ll-third-swim",
        theme: "sports",
        body: {
          en: "When you swim in a pond or temple tank, you push the water backwards with your hands — and the water pushes you forwards. When you jump off a small boat onto the bank, the boat moves back. Every push has an equal push back in the opposite direction.",
          ta: "குளத்தில் நீந்தும்போது கைகளால் நீரைப் பின்னோக்கித் தள்ளுகிறீர்கள் — நீர் உங்களை முன்னோக்கித் தள்ளுகிறது. சிறிய படகிலிருந்து கரைக்குக் குதிக்கும்போது படகு பின்னோக்கி நகர்கிறது. ஒவ்வொரு தள்ளுதலுக்கும் சமமான எதிர்த் தள்ளுதல் உண்டு.",
        },
        breaksDown: {
          en: "The two forces act on different objects (you and the water), so they don't cancel out — that's why you still move.",
          ta: "இரண்டு விசைகளும் வெவ்வேறு பொருள்கள் மீது (நீங்கள், நீர்) செயல்படுகின்றன; எனவே ஒன்றையொன்று சமன் செய்வதில்லை — அதனால்தான் நீங்கள் நகர்கிறீர்கள்.",
        },
      },
    ],
  },

  // ---------------------------------------------------------------- Optics, heat, sound
  {
    id: "ll-eye-camera",
    chapterIds: ["c10-science-ch2"],
    concept: { en: "The human eye and accommodation", ta: "மனிதக் கண் மற்றும் விழி ஏற்பமைவுத் திறன்" },
    analogies: [
      {
        id: "ll-eye-phone",
        theme: "home",
        body: {
          en: "Your eye works like a phone camera. The eye lens is the camera lens, the retina is the sensor that catches the picture, and the pupil is like the opening that lets in more or less light. When you look from your book to the blackboard, the eye muscles change the lens shape to refocus — like the camera's autofocus.",
          ta: "உங்கள் கண் ஒரு கைபேசி கேமரா போலச் செயல்படுகிறது. கண் லென்ஸ் கேமரா லென்ஸ்; விழித்திரை படத்தைப் பிடிக்கும் உணரி; கண்மணி ஒளியை அதிகமாகவோ குறைவாகவோ உள்ளே விடும் திறப்பு. புத்தகத்திலிருந்து கரும்பலகையைப் பார்க்கும்போது கண் தசைகள் லென்ஸின் வடிவத்தை மாற்றிக் குவியம் செய்கின்றன — கேமராவின் தானியங்கிக் குவியம் போல.",
        },
        breaksDown: {
          en: "A phone camera moves its lens back and forth to focus; your eye changes the lens's thickness instead. And the picture on the retina is upside down — your brain flips it.",
          ta: "கைபேசி கேமரா குவியத்துக்கு லென்ஸை முன்னும் பின்னும் நகர்த்துகிறது; கண் லென்ஸின் தடிமனை மாற்றுகிறது. மேலும் விழித்திரையில் விழும் படம் தலைகீழானது — மூளை அதைச் சரி செய்கிறது.",
        },
      },
    ],
  },
  {
    id: "ll-thermal-expansion",
    chapterIds: ["c10-science-ch3", "c8-science-ch5", "c7-science-ch5", "c6-science-ch7"],
    concept: { en: "Thermal expansion", ta: "வெப்ப விரிவு" },
    analogies: [
      {
        id: "ll-expansion-tumbler",
        theme: "kitchen",
        body: {
          en: "A steel tumbler stuck tight inside another? Pour hot water over the outer one. It expands a little, the gap grows, and the inner tumbler slips out. Railway tracks have small gaps between rails for the same reason — on a hot afternoon the rails expand.",
          ta: "ஒரு எஃகு டம்ளர் இன்னொன்றுக்குள் இறுகிச் சிக்கிவிட்டதா? வெளி டம்ளர் மீது சூடான நீரை ஊற்றுங்கள். அது சற்று விரிவடைந்து இடைவெளி பெரிதாகும்; உள் டம்ளர் வெளியே வந்துவிடும். இதே காரணத்தால்தான் இருப்புப் பாதைத் தண்டவாளங்களுக்கு இடையே சிறு இடைவெளி விடப்படுகிறது — வெயில் நேரத்தில் அவை விரிவடைகின்றன.",
        },
        breaksDown: {
          en: "The trick works best if only the outer tumbler gets hot; if both heat up equally, both expand and stay stuck.",
          ta: "வெளி டம்ளர் மட்டும் சூடானால்தான் இது நன்றாக வேலை செய்யும்; இரண்டும் சமமாகச் சூடானால் இரண்டுமே விரிவடைந்து சிக்கியபடியே இருக்கும்.",
        },
      },
    ],
  },
  {
    id: "ll-doppler",
    chapterIds: ["c10-science-ch5", "c8-science-ch8"],
    concept: { en: "Doppler effect", ta: "டாப்ளர் விளைவு" },
    analogies: [
      {
        id: "ll-doppler-ambulance",
        theme: "travel",
        body: {
          en: "Stand by the road as an ambulance races past. Its siren sounds higher as it comes towards you and suddenly lower as it goes away — even though the siren itself never changes. Coming closer squeezes the sound waves together (higher pitch); moving away stretches them out (lower pitch).",
          ta: "சாலையோரம் நின்று விரைந்து செல்லும் ஆம்புலன்ஸைக் கவனியுங்கள். அது உங்களை நோக்கி வரும்போது சைரன் ஒலி உச்சமாகவும், கடந்து செல்லும்போது திடீரெனத் தாழ்வாகவும் கேட்கிறது — சைரன் மாறவே இல்லை என்றாலும். நெருங்கும்போது ஒலி அலைகள் நெருக்கப்படுகின்றன (உயர் சுருதி); விலகும்போது நீட்டப்படுகின்றன (தாழ் சுருதி).",
        },
        breaksDown: {
          en: "The loudness also changes as it comes closer, but the Doppler effect is only about the pitch (frequency), not the loudness.",
          ta: "நெருங்கும்போது ஒலியின் உரப்பும் மாறுகிறது; ஆனால் டாப்ளர் விளைவு சுருதி (அதிர்வெண்) பற்றியது மட்டுமே, உரப்பு பற்றியதல்ல.",
        },
      },
    ],
  },

  // ---------------------------------------------------------------- Chemistry
  {
    id: "ll-atoms-letters",
    chapterIds: ["c10-science-ch7", "c7-science-ch3", "c8-science-ch4"],
    concept: { en: "Atoms and molecules", ta: "அணுக்களும் மூலக்கூறுகளும்" },
    analogies: [
      {
        id: "ll-atoms-tamil-letters",
        theme: "school",
        body: {
          en: "Atoms are like letters, molecules are like words. Tamil has a fixed set of letters, yet they join to make lakhs of words. In the same way, about 118 kinds of atoms join to make millions of substances. H₂O is a 'word' made of two H 'letters' and one O 'letter'.",
          ta: "அணுக்கள் எழுத்துகள் போன்றவை, மூலக்கூறுகள் சொற்கள் போன்றவை. தமிழில் குறிப்பிட்ட எண்ணிக்கையிலான எழுத்துகளே உள்ளன; ஆனால் அவை சேர்ந்து லட்சக்கணக்கான சொற்களை உருவாக்குகின்றன. அதுபோல சுமார் 118 வகை அணுக்கள் சேர்ந்து கோடிக்கணக்கான பொருள்களை உருவாக்குகின்றன. H₂O என்பது இரண்டு H 'எழுத்துகளும்' ஒரு O 'எழுத்தும்' சேர்ந்த ஒரு 'சொல்'.",
        },
        breaksDown: {
          en: "Letters can be put in any order, but atoms only join in ways their bonding allows — you can't make 'H₅O'.",
          ta: "எழுத்துகளை எந்த வரிசையிலும் வைக்கலாம்; ஆனால் அணுக்கள் அவற்றின் இணைதிறன் அனுமதிக்கும் வகையில் மட்டுமே சேரும் — 'H₅O' என்று உருவாக்க முடியாது.",
        },
      },
    ],
  },
  {
    id: "ll-mole",
    chapterIds: ["c10-science-ch7"],
    concept: { en: "The mole", ta: "மோல்" },
    analogies: [
      {
        id: "ll-mole-dozen",
        theme: "market",
        body: {
          en: "At the market you buy bananas by the dozen (12) and paper by the ream (500). Chemists count atoms by the mole: 6.022 × 10²³ particles. Atoms are so tiny that you need this huge 'dozen' to get an amount you can weigh on a balance.",
          ta: "சந்தையில் வாழைப்பழங்களை டஜன் (12) கணக்கில் வாங்குகிறோம். வேதியியலாளர்கள் அணுக்களை மோல் கணக்கில் எண்ணுகிறார்கள்: 6.022 × 10²³ துகள்கள். அணுக்கள் மிகச் சிறியவை; எனவே தராசில் எடை போடும் அளவுக்கு வர இந்த மிகப்பெரிய 'டஜன்' தேவைப்படுகிறது.",
        },
        breaksDown: {
          en: "A dozen bananas and a dozen jackfruits weigh very differently — and so does a mole of hydrogen (about 1 g) versus a mole of carbon (12 g). Same count, different mass.",
          ta: "ஒரு டஜன் வாழைப்பழமும் ஒரு டஜன் பலாப்பழமும் ஒரே எடையல்ல — அதுபோல ஒரு மோல் ஹைட்ரஜனும் (சுமார் 1 கி) ஒரு மோல் கார்பனும் (12 கி) வேறுபடும். எண்ணிக்கை ஒன்றே, நிறை வேறு.",
        },
      },
    ],
  },
  {
    id: "ll-catenation",
    chapterIds: ["c10-science-ch9"],
    concept: { en: "Catenation (carbon chains)", ta: "சங்கிலித் தொடராக்கம் (கார்பன் சங்கிலிகள்)" },
    analogies: [
      {
        id: "ll-catenation-garland",
        theme: "festival",
        body: {
          en: "Think of a jasmine garland. Each flower is tied to the next, making a long string; strings can branch or be joined into rings. Carbon atoms do the same: they link to other carbon atoms to form long chains, branches and rings. That's why there are so many carbon compounds.",
          ta: "மல்லிகைச் சரத்தை நினைத்துப் பாருங்கள். ஒவ்வொரு பூவும் அடுத்ததோடு கட்டப்பட்டு நீண்ட சரமாகிறது; சரம் கிளைக்கலாம் அல்லது வளையமாகவும் இணைக்கப்படலாம். கார்பன் அணுக்களும் அப்படியே: பிற கார்பன் அணுக்களுடன் இணைந்து நீண்ட சங்கிலிகள், கிளைகள், வளையங்களை உருவாக்குகின்றன. அதனால்தான் கார்பன் சேர்மங்கள் இவ்வளவு அதிகம்.",
        },
        breaksDown: {
          en: "Each carbon can hold exactly four bonds — a flower on a garland has no such limit.",
          ta: "ஒவ்வொரு கார்பனும் சரியாக நான்கு பிணைப்புகளை மட்டுமே கொள்ளும் — மாலையில் உள்ள பூவுக்கு அத்தகைய வரம்பு இல்லை.",
        },
      },
    ],
  },

  // ---------------------------------------------------------------- Biology
  {
    id: "ll-photosynthesis",
    chapterIds: ["c10-science-ch10", "c9-science-ch9", "c4-science-ch5"],
    concept: { en: "Photosynthesis", ta: "ஒளிச்சேர்க்கை" },
    analogies: [
      {
        id: "ll-photo-kitchen",
        theme: "kitchen",
        body: {
          en: "A leaf is a kitchen. Sunlight is the stove's flame, water (from the roots) and carbon dioxide (from the air) are the ingredients, chlorophyll is the cook, and sugar is the meal. Oxygen is what's left over — like the steam that leaves the kitchen window (the stomata).",
          ta: "இலை ஒரு சமையலறை. சூரிய ஒளி அடுப்பின் தீ; வேரிலிருந்து வரும் நீரும் காற்றிலிருந்து வரும் கார்பன் டை ஆக்சைடும் சமையல் பொருள்கள்; பச்சையம் சமையல்காரர்; சர்க்கரை உணவு. ஆக்சிஜன் மிஞ்சியது — சமையலறை ஜன்னல் (இலைத்துளைகள்) வழியே வெளியேறும் ஆவி போல.",
        },
        breaksDown: {
          en: "A stove burns fuel to make heat; a leaf does the opposite — it stores the sun's energy inside the sugar it makes.",
          ta: "அடுப்பு எரிபொருளை எரித்து வெப்பம் தருகிறது; இலை அதற்கு நேர்மாறாக — சூரிய ஆற்றலைத் தான் தயாரிக்கும் சர்க்கரைக்குள் சேமிக்கிறது.",
        },
      },
      {
        id: "ll-photo-farm",
        theme: "farm",
        body: {
          en: "A farmer's field turns sunlight, water and air into rice — the same way each leaf does. The rice you eat is sunlight stored by photosynthesis. No sunlight, no harvest.",
          ta: "விவசாயியின் வயல் சூரிய ஒளி, நீர், காற்று ஆகியவற்றை அரிசியாக மாற்றுகிறது — ஒவ்வொரு இலையும் செய்வது போலவே. நீங்கள் உண்ணும் சோறு ஒளிச்சேர்க்கை மூலம் சேமிக்கப்பட்ட சூரிய ஒளியே. சூரிய ஒளி இல்லையேல் அறுவடை இல்லை.",
        },
        breaksDown: {
          en: "Soil gives plants minerals, but not their food — most of a plant's mass actually comes from carbon dioxide in the air.",
          ta: "மண் தாவரங்களுக்குக் கனிமங்களைத் தருகிறது, உணவை அல்ல — தாவரத்தின் பெரும்பாலான நிறை உண்மையில் காற்றிலுள்ள கார்பன் டை ஆக்சைடிலிருந்தே வருகிறது.",
        },
      },
    ],
  },
  {
    id: "ll-cell-village",
    chapterIds: ["c6-science-ch10", "c7-science-ch7", "c9-science-ch9"],
    concept: { en: "Parts of a cell", ta: "செல்லின் பகுதிகள்" },
    analogies: [
      {
        id: "ll-cell-village-office",
        theme: "home",
        body: {
          en: "A cell is like a village. The nucleus is the panchayat office where the plans (DNA) are kept. Mitochondria are the power station giving energy. The cell membrane is the village boundary with a watchman deciding who comes in and goes out. Cytoplasm is the open ground where all the work happens.",
          ta: "செல் ஒரு கிராமம் போன்றது. உட்கரு திட்டங்கள் (DNA) வைக்கப்பட்டுள்ள ஊராட்சி அலுவலகம். மைட்டோகாண்ட்ரியா ஆற்றல் தரும் மின்நிலையம். செல் சவ்வு யார் உள்ளே வரலாம், வெளியே போகலாம் என்று முடிவு செய்யும் காவலாளி உள்ள கிராம எல்லை. சைட்டோபிளாசம் எல்லா வேலைகளும் நடக்கும் திறந்த வெளி.",
        },
        breaksDown: {
          en: "A village has people who choose what to do; a cell's parts just follow chemistry, with no one in charge.",
          ta: "கிராமத்தில் மக்கள் முடிவெடுக்கிறார்கள்; செல்லின் பகுதிகள் வேதியியல் விதிகளைப் பின்பற்றுகின்றன — யாரும் 'தலைவர்' இல்லை.",
        },
      },
    ],
  },
  {
    id: "ll-dna-recipe",
    chapterIds: ["c10-science-ch11"],
    concept: { en: "Genes and heredity", ta: "மரபணுக்களும் பாரம்பரியமும்" },
    analogies: [
      {
        id: "ll-dna-recipe-book",
        theme: "kitchen",
        body: {
          en: "DNA is like the family recipe notebook passed from grandmother to mother to you. Each recipe is a gene — one for eye colour, one for height. You get one copy of each recipe from your mother and one from your father, which is why you look a bit like both.",
          ta: "DNA என்பது பாட்டியிடமிருந்து அம்மாவுக்கு, அம்மாவிடமிருந்து உங்களுக்கு வரும் குடும்பச் சமையல் குறிப்பேடு போன்றது. ஒவ்வொரு சமையல் குறிப்பும் ஒரு மரபணு — கண் நிறத்துக்கு ஒன்று, உயரத்துக்கு ஒன்று. ஒவ்வொரு குறிப்பின் ஒரு நகல் அம்மாவிடமிருந்தும் ஒன்று அப்பாவிடமிருந்தும் வருகிறது; அதனால்தான் நீங்கள் இருவரையும் சற்றுச் சாயலில் ஒத்திருக்கிறீர்கள்.",
        },
        breaksDown: {
          en: "You can change a recipe whenever you like; you can't edit your genes. And many traits depend on many genes plus food and environment, not one recipe.",
          ta: "சமையல் குறிப்பை விரும்பும்போது மாற்றலாம்; மரபணுக்களை மாற்ற முடியாது. மேலும் பல பண்புகள் பல மரபணுக்களையும் உணவு, சூழலையும் சார்ந்தவை.",
        },
      },
    ],
  },

  // ---------------------------------------------------------------- Fluids
  {
    id: "ll-buoyancy",
    chapterIds: ["c9-science-ch3", "c8-science-ch2"],
    concept: { en: "Buoyancy (Archimedes' principle)", ta: "மிதப்பு விசை (ஆர்க்கிமிடிஸ் தத்துவம்)" },
    analogies: [
      {
        id: "ll-buoyancy-well",
        theme: "home",
        body: {
          en: "Pull a bucket up from a well. It feels light while it's under the water and suddenly heavy the moment it comes out. The water was pushing it up with a force equal to the weight of the water the bucket pushed aside — that upward push is buoyancy.",
          ta: "கிணற்றிலிருந்து வாளியை இழுங்கள். நீருக்குள் இருக்கும்போது இலேசாகவும், நீரை விட்டு வெளியே வந்ததும் திடீரெனக் கனமாகவும் இருக்கிறது. வாளி இடம்பெயர்த்த நீரின் எடைக்குச் சமமான விசையுடன் நீர் அதை மேலே தள்ளியது — அந்த மேல்நோக்கிய தள்ளுதலே மிதப்பு விசை.",
        },
        breaksDown: {
          en: "The bucket's real weight never changed — only the water's upward push did. Out of the water, that help is gone.",
          ta: "வாளியின் உண்மையான எடை மாறவே இல்லை — நீரின் மேல்நோக்கிய தள்ளுதல் மட்டுமே மாறியது. நீருக்கு வெளியே அந்த உதவி இல்லை.",
        },
      },
    ],
  },
  {
    id: "ll-pascal",
    chapterIds: ["c9-science-ch3", "c8-science-ch2"],
    concept: { en: "Pressure in liquids (Pascal's law)", ta: "திரவங்களில் அழுத்தம் (பாஸ்கல் விதி)" },
    analogies: [
      {
        id: "ll-pascal-toothpaste",
        theme: "home",
        body: {
          en: "Squeeze a toothpaste tube anywhere — the bottom, the middle, the side — and paste comes out of the top. The pressure you apply spreads equally through the whole tube. Hydraulic jacks at the mechanic's shop use this to lift a car with one hand.",
          ta: "பற்பசைக் குழாயை எங்கு அழுத்தினாலும் — அடியில், நடுவில், பக்கத்தில் — மேலே பசை வருகிறது. நீங்கள் கொடுக்கும் அழுத்தம் குழாய் முழுவதும் சமமாகப் பரவுகிறது. மெக்கானிக் கடையில் உள்ள நீரியல் தூக்கி (ஹைட்ராலிக் ஜாக்) இதைப் பயன்படுத்தியே ஒரு கையால் காரைத் தூக்குகிறது.",
        },
        breaksDown: {
          en: "Toothpaste is thick and doesn't flow freely, so it's not a perfect fluid. Pascal's law is exact for liquids in a closed container.",
          ta: "பற்பசை கெட்டியானது, தாராளமாகப் பாய்வதில்லை; எனவே அது முழுமையான பாய்மம் அல்ல. பாஸ்கல் விதி மூடிய கலனில் உள்ள திரவங்களுக்குத் துல்லியமாகப் பொருந்தும்.",
        },
      },
    ],
  },

  // ---------------------------------------------------------------- Maths
  {
    id: "ll-fractions",
    chapterIds: FRACTION_CHAPTERS,
    concept: { en: "Fractions", ta: "பின்னங்கள்" },
    analogies: [
      {
        id: "ll-fractions-dosa",
        theme: "kitchen",
        body: {
          en: "Amma makes one big dosa and cuts it into 4 equal pieces. Each piece is 1/4. If you eat 3 pieces, you've eaten 3/4. If she cuts it into 8 pieces instead, each piece is smaller (1/8) — a bigger number at the bottom means smaller pieces.",
          ta: "அம்மா ஒரு பெரிய தோசையைச் சுட்டு 4 சம துண்டுகளாக வெட்டுகிறார். ஒவ்வொரு துண்டும் 1/4. நீங்கள் 3 துண்டுகள் சாப்பிட்டால் 3/4 சாப்பிட்டிருக்கிறீர்கள். 8 துண்டுகளாக வெட்டினால் ஒவ்வொன்றும் சிறியது (1/8) — கீழே உள்ள எண் பெரிதானால் துண்டு சிறியதாகும்.",
        },
        breaksDown: {
          en: "Real dosa pieces are never exactly equal; in maths a fraction's parts must be exactly equal.",
          ta: "உண்மையான தோசைத் துண்டுகள் எப்போதும் சரிசமமாக இருப்பதில்லை; கணிதத்தில் பின்னத்தின் பகுதிகள் துல்லியமாகச் சமமாக இருக்க வேண்டும்.",
        },
      },
      {
        id: "ll-fractions-idli",
        theme: "home",
        body: {
          en: "There are 8 idlis and 4 people. Each person gets 8 ÷ 4 = 2 idlis, which is 2/8 = 1/4 of the plate. Fractions can be parts of one thing (a dosa) or parts of a group (a plate of idlis).",
          ta: "8 இட்லிகள், 4 பேர். ஒவ்வொருவருக்கும் 8 ÷ 4 = 2 இட்லிகள்; அது தட்டின் 2/8 = 1/4 பங்கு. பின்னம் ஒரு பொருளின் பகுதியாகவும் (ஒரு தோசை) ஒரு குழுவின் பகுதியாகவும் (ஒரு தட்டு இட்லி) இருக்கலாம்.",
        },
        breaksDown: {
          en: "With a group, the parts are counted, not cut — you can't take 1/3 of 8 idlis without cutting one.",
          ta: "குழுவில் பகுதிகள் எண்ணப்படுகின்றன, வெட்டப்படுவதில்லை — ஓர் இட்லியை வெட்டாமல் 8 இட்லிகளின் 1/3 பங்கை எடுக்க முடியாது.",
        },
      },
    ],
  },
  {
    id: "ll-ratio",
    chapterIds: ["c6-math-ch3", "c7-math-ch4"],
    concept: { en: "Ratio and proportion", ta: "விகிதம் மற்றும் விகித சமம்" },
    analogies: [
      {
        id: "ll-ratio-rice",
        theme: "kitchen",
        body: {
          en: "To cook rice, Amma uses 1 cup of rice to 2 cups of water — a ratio of 1 : 2. For more guests she uses 3 cups of rice, so she needs 6 cups of water. 1 : 2 and 3 : 6 are in proportion: the taste stays the same because the ratio stays the same.",
          ta: "சோறு சமைக்க அம்மா 1 குவளை அரிசிக்கு 2 குவளை நீர் வைக்கிறார் — விகிதம் 1 : 2. விருந்தினர் அதிகம் என்றால் 3 குவளை அரிசி, எனவே 6 குவளை நீர் தேவை. 1 : 2, 3 : 6 இரண்டும் விகித சமம்: விகிதம் மாறாததால் சுவையும் மாறவில்லை.",
        },
        breaksDown: {
          en: "In a real kitchen, the right amount of water also depends on the type of rice and the pot; a maths ratio has no such exceptions.",
          ta: "உண்மையில் நீரின் அளவு அரிசி வகையையும் பாத்திரத்தையும் பொறுத்தும் மாறும்; கணித விகிதத்துக்கு அத்தகைய விதிவிலக்குகள் இல்லை.",
        },
      },
    ],
  },
  {
    id: "ll-simple-interest",
    chapterIds: ["c7-math-ch9", "c8-math-ch5"],
    concept: { en: "Interest", ta: "வட்டி" },
    analogies: [
      {
        id: "ll-interest-cycle-rent",
        theme: "market",
        body: {
          en: "You rent a cycle for ₹20 a day. Keep it 5 days, pay ₹100 rent. Interest is rent for money: borrow ₹1,000 at 10% a year and you pay ₹100 'rent' for each year you keep it. Simple interest = principal × rate × time ÷ 100.",
          ta: "ஒரு மிதிவண்டியை நாளுக்கு ₹20 வாடகைக்கு எடுக்கிறீர்கள். 5 நாள் வைத்திருந்தால் ₹100 வாடகை. வட்டி என்பது பணத்துக்கான வாடகை: ₹1,000-ஐ ஆண்டுக்கு 10% வட்டிக்குக் கடன் வாங்கினால், வைத்திருக்கும் ஒவ்வோர் ஆண்டுக்கும் ₹100 'வாடகை'. தனிவட்டி = அசல் × வீதம் × காலம் ÷ 100.",
        },
        breaksDown: {
          en: "With compound interest (Class 8), the 'rent' itself starts earning rent each year — the cycle shop never does that.",
          ta: "கூட்டு வட்டியில் (வகுப்பு 8) 'வாடகைக்கே' அடுத்த ஆண்டு வாடகை சேரும் — மிதிவண்டிக் கடை அப்படிச் செய்வதில்லை.",
        },
      },
    ],
  },

  // ---------------------------------------------------------------- Civics
  {
    id: "ll-democracy",
    chapterIds: ["c6-social-ch12"],
    concept: { en: "Democracy and elections", ta: "மக்களாட்சியும் தேர்தலும்" },
    analogies: [
      {
        id: "ll-democracy-class-leader",
        theme: "school",
        body: {
          en: "When your class chooses a class leader by vote, everyone gets one vote, the one with the most votes wins, and if the leader does a bad job you can choose someone else next term. That is democracy in miniature: power comes from the people, through regular, fair elections.",
          ta: "உங்கள் வகுப்பு வாக்களித்து வகுப்புத் தலைவரைத் தேர்ந்தெடுக்கும்போது, ஒவ்வொருவருக்கும் ஒரு வாக்கு; அதிக வாக்கு பெற்றவர் வெல்கிறார்; தலைவர் சரியாகச் செயல்படவில்லையென்றால் அடுத்த பருவத்தில் வேறொருவரைத் தேர்ந்தெடுக்கலாம். இதுவே சிறிய அளவிலான மக்களாட்சி: அதிகாரம் மக்களிடமிருந்து, முறையான நியாயமான தேர்தல்கள் மூலம் வருகிறது.",
        },
        breaksDown: {
          en: "A country also needs things a classroom doesn't: a constitution, courts, a free press and protection of minority rights even when the majority disagrees.",
          ta: "ஒரு நாட்டுக்கு வகுப்பறைக்குத் தேவைப்படாதவையும் தேவை: அரசியலமைப்பு, நீதிமன்றங்கள், சுதந்திரமான ஊடகம், பெரும்பான்மை உடன்படாவிட்டாலும் சிறுபான்மையினர் உரிமைப் பாதுகாப்பு.",
        },
      },
    ],
  },
];

const BY_CHAPTER = new Map<string, LifeLinkConcept[]>();
for (const concept of LIFE_LINKS) {
  for (const chapterId of concept.chapterIds) {
    const list = BY_CHAPTER.get(chapterId) ?? [];
    list.push(concept);
    BY_CHAPTER.set(chapterId, list);
  }
}

/** Life Link concepts written for a chapter (empty when none yet). */
export function lifeLinksFor(chapterId: string): readonly LifeLinkConcept[] {
  return BY_CHAPTER.get(chapterId) ?? [];
}

/** How many chapters have at least one Life Link. */
export function lifeLinkChapterCount(): number {
  return BY_CHAPTER.size;
}
