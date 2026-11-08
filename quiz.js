
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const STORE = "likhaQuizDataV1";
  const POINTS_PER_CORRECT = 10;
  const PET_POINTS_PER_CORRECT = 2;

  // ========================================
  // WEEKLY QUIZ QUESTIONS
  // ========================================

  const questions = [
    {
      id: "history-community-then-now",
      category: "Historical Filipino Identity",
      question: "A learner is planning a mural about how a town changed over time. Which plan best connects the town's past with its present?",
      options: ["Show an old town scene beside a present-day scene and explain what changed", "Focus only on the present-day building and omit its history", "Show two scenes from different places instead of different times", "Use an antique-looking palette without historical details"],
      answer: 0,
      explanation: "Comparing scenes from different times helps viewers notice historical change and how it shapes a community today."
    },
    {
      id: "history-family-objects",
      category: "Historical Filipino Identity",
      question: "An artist finds an old family photograph and wants to honor earlier generations. What should the artist do to make the artwork historically meaningful?",
      options: ["Use the photograph as a starting point and learn the story behind it", "Add a date based only on how old the photo looks", "Keep the image but omit the family story behind it", "Present the earlier scene as if it were happening today"],
      answer: 0,
      explanation: "Researching the photograph's story helps the artist represent family history accurately and respectfully."
    },
    {
      id: "history-local-landmark",
      category: "Historical Filipino Identity",
      question: "A class is creating an artwork about an old local landmark. Which source would best help students represent its history responsibly?",
      options: ["A local history book or a knowledgeable community member", "A recent tourism post that gives no source for its facts", "A visual guess based only on the building's style", "A written account about a similar landmark in another town"],
      answer: 0,
      explanation: "Reliable records and community knowledge can provide context and reduce inaccurate historical details."
    },
    {
      id: "history-change-symbol",
      category: "Historical Filipino Identity",
      question: "A digital collage places a traditional fishing boat beside a modern boat. What idea could this contrast communicate most clearly?",
      options: ["How ways of life and technology can change over time", "How two communities use boats in different environments", "That older ways of life have no connection to people today", "That both boats must represent the same historical period"],
      answer: 0,
      explanation: "Contrasting objects from different periods can help viewers consider continuity and change in Filipino communities."
    },
    {
      id: "history-heritage-mural",
      category: "Historical Filipino Identity",
      question: "A learner wants a mural to show how a community remembers an important event. Which detail would make the message easier to understand?",
      options: ["A caption or visual clue that identifies the event and its time", "A broad title that does not identify which event is shown", "A familiar symbol that is not connected to the event", "A date that refers to a different moment in the community's history"],
      answer: 0,
      explanation: "Relevant details and context help viewers connect the artwork to the event being remembered."
    },
    {
      id: "culture-weaving-pattern",
      category: "Cultural Filipino Identity",
      question: "A learner is inspired by a woven pattern from a Filipino community. What is the most respectful first step before using it in a new artwork?",
      options: ["Learn about its source, meaning, and any community guidance", "Assume every pattern has the same meaning", "Copy it and claim it as a newly invented design", "Change its colors without learning anything about it"],
      answer: 0,
      explanation: "Learning a pattern's context helps an artist avoid misrepresenting cultural meaning and acknowledge its source."
    },
    {
      id: "culture-fiesta-scene",
      category: "Cultural Filipino Identity",
      question: "An artist paints neighbors preparing food together for a local celebration. Which idea is most strongly supported by this scene?",
      options: ["Shared community traditions and cooperation", "A rule that every Filipino celebration is identical", "A message that local customs should be forgotten", "A description of painting materials"],
      answer: 0,
      explanation: "People preparing together can show community cooperation and a tradition shared in that particular place."
    },
    {
      id: "culture-oral-history",
      category: "Cultural Filipino Identity",
      question: "A student wants to illustrate a story passed down by elders. Which choice would best preserve the story's cultural meaning?",
      options: ["Listen to the storyteller and include details that reflect the story's context", "Use a familiar version without checking the community's telling", "Change an important event without identifying the work as an adaptation", "Focus on the setting but leave out details that explain the story"],
      answer: 0,
      explanation: "Listening to the source and keeping its context helps the artwork honor the community's storytelling tradition."
    },
    {
      id: "culture-language-lettering",
      category: "Cultural Filipino Identity",
      question: "A poster includes a Filipino-language greeting from a community celebration. What would help the lettering support the artwork respectfully?",
      options: ["Check its spelling and meaning with a reliable speaker or source", "Choose letters only because they look decorative", "Translate it into a phrase with a different meaning", "Use it without considering where it comes from"],
      answer: 0,
      explanation: "Checking language and meaning helps ensure that cultural details communicate what the artist intends."
    },
    {
      id: "culture-tradition-diversity",
      category: "Cultural Filipino Identity",
      question: "A class exhibition shows traditions from several Filipino communities. Which curatorial choice best represents cultural diversity?",
      options: ["Identify each community and avoid suggesting one tradition represents everyone", "Label every artwork with the same community name", "Remove details that distinguish the communities", "Arrange the works to show that only one tradition matters"],
      answer: 0,
      explanation: "Filipino culture is diverse; identifying each context avoids treating different communities as if they were all the same."
    },
    {
      id: "national-bayanihan",
      category: "National Filipino Identity",
      question: "A learner wants to show how Filipinos help one another after a typhoon. Which scene best communicates bayanihan?",
      options: ["Neighbors carrying supplies and rebuilding together", "A single object with no people or community clues", "A group organizing supplies separately without showing cooperation", "A landscape that suggests recovery but leaves community action unclear"],
      answer: 0,
      explanation: "People working together to support affected families clearly communicates cooperation and bayanihan."
    },
    {
      id: "national-flag-context",
      category: "National Filipino Identity",
      question: "A student includes the Philippine flag in a painting about unity. Which approach best uses it meaningfully?",
      options: ["Place it in a scene where people work together and connect it to the message", "Place it in the background without connecting it to the theme", "Change its design but describe it as an accurate depiction", "Use it as the subject while leaving the unity message unclear"],
      answer: 0,
      explanation: "A national symbol is strongest when its placement and surrounding scene support the meaning the artist intends."
    },
    {
      id: "national-shared-experience",
      category: "National Filipino Identity",
      question: "An artwork will be displayed during a national celebration. Which subject could help viewers reflect on shared Filipino identity without claiming everyone has the same experience?",
      options: ["People from different regions contributing to a shared community project", "One regional custom presented as if every Filipino practices it", "A scene focused on one region but labeled as the whole country", "Several national symbols without showing how people connect to them"],
      answer: 0,
      explanation: "Showing people from different regions working together can express shared identity while recognizing diversity."
    },
    {
      id: "national-landscape",
      category: "National Filipino Identity",
      question: "A learner wants a landscape to express care for the Philippines. Which addition would make that national message clearer?",
      options: ["Show local people caring for the land and explain why it matters", "Show the landscape but leave its connection to Filipino life unclear", "Rely on a title to explain a message the image does not suggest", "Use a landscape from another place without identifying its location"],
      answer: 0,
      explanation: "Connecting people, place, and care for the environment makes the intended sense of belonging easier to read."
    },
    {
      id: "national-hero-respect",
      category: "National Filipino Identity",
      question: "A student creates a portrait of a Filipino hero for a school exhibit. What makes the portrait more than a simple likeness?",
      options: ["Visual choices that connect the person to the values or history being honored", "Adding many decorations that hide the person", "Using a title that contradicts the exhibit", "Copying facial features but ignoring the historical purpose"],
      answer: 0,
      explanation: "A meaningful portrait links its subject to the history or values that the artist wants viewers to remember."
    },
    {
      id: "subject-theme-family",
      category: "Subject and Theme",
      question: "A painting shows a family sharing a meal. The artist wants viewers to think about care across generations. Which statement correctly separates subject and theme?",
      options: ["The family meal is the subject; care across generations is the theme", "Care across generations is the subject; the meal is the medium", "The family's clothing is the theme; care is the style", "The title is the medium; the canvas is the theme"],
      answer: 0,
      explanation: "The subject is what is shown, while the theme is the larger idea or message communicated."
    },
    {
      id: "subject-theme-community",
      category: "Subject and Theme",
      question: "Two posters show a neighborhood fiesta. One celebrates cooperation, while the other asks people to protect local traditions. What does this comparison show?",
      options: ["The same subject can communicate different themes", "Every artwork with a fiesta has the same theme", "A theme is always the material used", "A subject can only be a person"],
      answer: 0,
      explanation: "Artists can use the same subject to communicate different ideas depending on their choices."
    },
    {
      id: "subject-theme-disaster",
      category: "Subject and Theme",
      question: "A learner's artwork shows volunteers distributing food after a flood. Which theme is best supported by that subject?",
      options: ["Community care during a difficult time", "The importance of food preparation", "The effect of flooding on local homes", "A celebration that is not shown in the scene"],
      answer: 0,
      explanation: "The volunteers' actions suggest a theme of cooperation and care during a community challenge."
    },
    {
      id: "subject-theme-interpret",
      category: "Subject and Theme",
      question: "Viewers disagree about the theme of an artwork showing a child planting a tree beside an old house. What should they examine to support their interpretations?",
      options: ["The image's details, title, and the artist's stated intention", "The artwork's medium without considering its imagery", "A viewer's first reaction without looking for visual evidence", "The artwork's size without considering its context"],
      answer: 0,
      explanation: "Visual clues, titles, and artist statements provide evidence for interpreting a theme."
    },
    {
      id: "subject-theme-change",
      category: "Subject and Theme",
      question: "A learner wants to change an artwork's subject from a single parol to a family making one together, while keeping the theme of hope. What has changed?",
      options: ["The subject has changed, but the theme can remain", "The theme must change whenever the subject changes", "Only the medium can change", "The style and message cannot be planned"],
      answer: 0,
      explanation: "An artist can express the same theme through different subjects."
    },
    {
      id: "form-composition",
      category: "Form and Style",
      question: "A mural has many important figures, but viewers cannot tell where to look first. Which change best improves its form?",
      options: ["Arrange the figures and shapes to create a clear visual path", "Add more details in every empty space", "Make all figures the same size without a reason", "Remove the main subject from the composition"],
      answer: 0,
      explanation: "Organizing the composition gives the artwork a clearer structure and guides the viewer's attention."
    },
    {
      id: "form-emphasis",
      category: "Form and Style",
      question: "An artist wants the viewer to notice a community volunteer first. Which formal choice would help?",
      options: ["Use placement, size, or contrast to emphasize the volunteer", "Emphasize the background so the volunteer is less noticeable", "Give every object equal emphasis even if the scene feels crowded", "Place the volunteer near the edge without a visual connection to the action"],
      answer: 0,
      explanation: "Placement, scale, and contrast can establish emphasis within an artwork's form."
    },
    {
      id: "style-folk-influence",
      category: "Form and Style",
      question: "A learner uses bold outlines and repeated decorative shapes inspired by local folk art. Which concept describes this recognizable way of making the image?",
      options: ["Style", "Subject", "Medium", "Theme"],
      answer: 0,
      explanation: "Style refers to an artist's visual approach, such as line quality, shape treatment, or repeated choices."
    },
    {
      id: "style-message-choice",
      category: "Form and Style",
      question: "A student wants a poster about a serious historical event to feel thoughtful rather than playful. Which style decision best supports that goal?",
      options: ["Choose a restrained visual approach that matches the subject and message", "Use a highly playful style that changes the event's intended tone", "Choose a detailed style that makes the central message hard to see", "Select a style for appearance alone without considering the audience"],
      answer: 0,
      explanation: "A suitable style strengthens the connection between the subject, message, and audience."
    },
    {
      id: "form-style-comparison",
      category: "Form and Style",
      question: "Two artists make paintings about the same Filipino celebration, but one uses a realistic arrangement and the other uses simplified geometric shapes. What is the clearest difference?",
      options: ["Their forms and styles differ even though the subject is shared", "Their themes must be identical because the subject is shared", "Their mediums must differ because the styles are different", "Their subjects differ because their compositions are not alike"],
      answer: 0,
      explanation: "Different arrangements and visual approaches can create distinct forms and styles for the same subject."
    },
    {
      id: "symbol-parol",
      category: "Symbolism",
      question: "A learner includes a parol in an artwork about hope and family during the holidays. What makes the parol function as a symbol?",
      options: ["It represents an idea beyond the object itself", "It is shown realistically as part of the holiday scene", "It is emphasized through its size and position", "It is made with a particular material"],
      answer: 0,
      explanation: "A symbol is an image or object used to represent a deeper idea, feeling, value, or identity."
    },
    {
      id: "symbol-context",
      category: "Symbolism",
      question: "A bird appears in two artworks, but it represents freedom in one and a family memory in the other. What should viewers consider?",
      options: ["The artwork's context and the artist's intended meaning", "A symbol dictionary without looking at either artwork", "The bird's color while ignoring the surrounding scene", "The assumption that familiar symbols always mean the same thing"],
      answer: 0,
      explanation: "A symbol's meaning can depend on its context and the artist's choices."
    },
    {
      id: "symbol-community-made",
      category: "Symbolism",
      question: "A class wants to represent cooperation without writing the word 'bayanihan.' Which image would work best as a symbol?",
      options: ["Several hands lifting and supporting one another", "One person completing the task while others watch", "A shared workspace without showing people cooperating", "A group portrait that does not show a shared action"],
      answer: 0,
      explanation: "Hands supporting one another can visually represent cooperation and shared effort."
    },
    {
      id: "symbol-national-emblem",
      category: "Symbolism",
      question: "A student uses a national symbol in a poster. Which action best helps prevent viewers from misunderstanding its role?",
      options: ["Connect it clearly to the poster's idea and explain the intended meaning", "Choose it mainly for its colors, without considering the poster's message", "Adapt its appearance without checking whether the meaning changes", "Use it to support a different idea from the one in the poster"],
      answer: 0,
      explanation: "Clear context helps viewers understand why the symbol is present and what it represents."
    },
    {
      id: "symbol-personal-cultural",
      category: "Symbolism",
      question: "A learner wants to use a family object as a symbol of Filipino identity. Which choice is strongest?",
      options: ["Choose an object with a real story and explain how it connects to the message", "Choose the first object nearby without considering meaning", "Use a borrowed symbol and claim its story as personal", "Add an object that conflicts with the artwork's purpose"],
      answer: 0,
      explanation: "A meaningful connection between the object, the artist's experience, and the message makes symbolism more effective."
    },
    {
      id: "medium-watercolor",
      category: "Medium and Materials",
      question: "A learner wants to show a rainy Philippine landscape with soft washes of color. Which medium is a practical choice?",
      options: ["Watercolor on suitable paper", "Acrylic paint on a non-absorbent surface that resists layering", "Oil pastel when transparent color washes are the main goal", "A sculpting medium when a flat painted landscape is required"],
      answer: 0,
      explanation: "Watercolor can create transparent washes that suit a soft, rainy landscape."
    },
    {
      id: "medium-digital-poster",
      category: "Medium and Materials",
      question: "A class needs to revise a poster several times and share it online. Which medium best supports those needs?",
      options: ["A digital illustration made with drawing software", "A stone carving that cannot be edited easily", "A temporary sand drawing with no photo", "A woven fabric that cannot be shared digitally"],
      answer: 0,
      explanation: "Digital artwork can be revised and shared online, making it suitable for this purpose."
    },
    {
      id: "medium-recycled",
      category: "Medium and Materials",
      question: "An artist plans a collage about caring for the environment. Which material choice supports both the message and the medium?",
      options: ["Clean reused paper and packaging arranged as a collage", "New materials discarded before the artwork is complete", "A digital file described as a physical sculpture", "Unrelated tools that cannot be attached to a surface"],
      answer: 0,
      explanation: "Reused materials can make the medium itself reinforce a message about reducing waste."
    },
    {
      id: "medium-community-access",
      category: "Medium and Materials",
      question: "A school has limited art supplies, but students want to create a group artwork about local traditions. Which plan is most practical?",
      options: ["Use available paper, pencils, and shared color materials thoughtfully", "Choose a medium based only on what is traditional, regardless of the project", "Give every student a different material without planning how the parts connect", "Select a format that cannot be displayed for the intended audience"],
      answer: 0,
      explanation: "Artists can choose accessible materials that fit the idea and the resources available."
    },
    {
      id: "medium-message",
      category: "Medium and Materials",
      question: "A student is choosing between a small hand-drawn storybook and a large wall mural to share a community story. What should guide the choice?",
      options: ["The audience, place, message, and materials available", "Which option uses the most expensive supplies", "A rule that all stories need the same medium", "The number of colors without considering the story"],
      answer: 0,
      explanation: "A suitable medium depends on how the audience will experience the artwork and what the artist needs to communicate."
    },
    {
      id: "traditional-contemporary-weaving",
      category: "Traditional and Contemporary Filipino Art",
      question: "A designer studies traditional weaving and creates a new digital pattern while crediting the source community. What best describes this approach?",
      options: ["A contemporary response informed by traditional art", "A claim that traditional art should never change", "A copy that has no connection to its source", "A historical artifact made in the past"],
      answer: 0,
      explanation: "Artists can respond to traditional art with new tools while acknowledging and respecting its source."
    },
    {
      id: "traditional-contemporary-tools",
      category: "Traditional and Contemporary Filipino Art",
      question: "A learner uses a tablet to illustrate a scene inspired by a local legend. Which statement is most accurate?",
      options: ["A contemporary tool can be used to explore cultural stories", "Digital tools automatically remove cultural meaning", "Only old materials can represent Filipino identity", "The story cannot be interpreted in a new medium"],
      answer: 0,
      explanation: "Contemporary tools can communicate cultural stories when the artist considers their context and meaning."
    },
    {
      id: "traditional-contemporary-change",
      category: "Traditional and Contemporary Filipino Art",
      question: "An artist adapts a traditional design for a public poster. Which step best balances creativity with respect?",
      options: ["Research the design, follow relevant guidance, and explain the adaptation", "Change it without learning its origin", "Say all designs from the Philippines are interchangeable", "Hide the source so viewers assume it is original"],
      answer: 0,
      explanation: "Research and clear acknowledgment help an artist adapt cultural inspiration responsibly."
    },
    {
      id: "traditional-contemporary-exhibition",
      category: "Traditional and Contemporary Filipino Art",
      question: "An exhibit places a traditional craft beside a contemporary artwork inspired by it. What can this arrangement help visitors explore?",
      options: ["How artistic ideas can continue and change across time", "How an older technique can be used without any reinterpretation", "Why traditional and contemporary works must have the same message", "Which work uses more materials, regardless of their meaning"],
      answer: 0,
      explanation: "Comparing works can reveal connections, reinterpretations, and changes in artistic practice."
    },
    {
      id: "traditional-contemporary-community",
      category: "Traditional and Contemporary Filipino Art",
      question: "A student wants to represent a living cultural tradition in a contemporary artwork. Which choice is most responsible?",
      options: ["Learn from community members and represent the tradition as living and diverse", "Show it as an unchanging practice from long ago", "Invent details and present them as community facts", "Use it only as decoration without context"],
      answer: 0,
      explanation: "Many traditions continue to develop; community knowledge helps represent them accurately and respectfully."
    },
    {
      id: "create-bayanihan-plan",
      category: "Creating and Evaluating Art",
      question: "A Grade 6 learner wants to create an artwork showing how Filipino communities help one another during disasters. Which artistic choice best communicates bayanihan?",
      options: ["Paint community members working together to help affected families", "Show families receiving aid but leave out the neighbors who organize it", "Focus on the storm damage without showing how people respond", "Use a national symbol without connecting it to community action"],
      answer: 0,
      explanation: "Showing people working together communicates bayanihan, cooperation, and community care."
    },
    {
      id: "create-family-theme",
      category: "Creating and Evaluating Art",
      question: "A learner wants an artwork about family stories to feel warm and welcoming. Which plan best connects the subject, theme, and visual choices?",
      options: ["Show relatives sharing a story and use a thoughtful, inviting arrangement", "Show a family gathering but use a composition that hides the storytelling", "Choose a dramatic style that makes the scene feel tense rather than welcoming", "Add cultural symbols without connecting them to the family story"],
      answer: 0,
      explanation: "A connected subject, theme, and composition help viewers understand the intended feeling."
    },
    {
      id: "create-symbol-select",
      category: "Creating and Evaluating Art",
      question: "A poster's theme is caring for the community. Which symbol should the artist choose?",
      options: ["An image that viewers can connect to shared care, such as hands helping one another", "A symbol selected only because it is difficult to draw", "An object whose meaning conflicts with the theme", "A decoration with no connection to the poster"],
      answer: 0,
      explanation: "A symbol should reinforce the theme and make the intended idea easier to recognize."
    },
    {
      id: "evaluate-poster-clarity",
      category: "Creating and Evaluating Art",
      question: "Two posters invite people to preserve a local tradition. Which evidence best shows that one poster communicates its message more clearly?",
      options: ["Its images, words, and layout all support the same idea", "Its images support preservation, but its wording suggests the opposite", "Its layout emphasizes decoration more than the local tradition", "Its title identifies the tradition, but the images give no supporting clues"],
      answer: 0,
      explanation: "A clear message is supported when the words, images, and composition work together."
    },
    {
      id: "create-artwork-medium",
      category: "Creating and Evaluating Art",
      question: "A learner plans a large outdoor artwork about protecting a local river. What should be considered when choosing its medium?",
      options: ["Durability, location, safety, message, and available materials", "The material's appearance without checking how it holds up outdoors", "The medium's popularity even if it is unsuitable for the site", "The artist's preferred tool without considering the audience or location"],
      answer: 0,
      explanation: "The setting and purpose affect which materials are practical and safe for an artwork."
    },
    {
      id: "evaluate-symbol-context",
      category: "Creating and Evaluating Art",
      question: "A student uses a cultural symbol in a class exhibit, but classmates say its meaning seems unclear. What is the best next step?",
      options: ["Research its meaning and revise the artwork or add a clear explanation", "Tell viewers they are wrong without providing context", "Add more symbols without checking their meanings", "Remove the title and all explanatory information"],
      answer: 0,
      explanation: "Research and revision can clarify meaning and help represent cultural symbols responsibly."
    },
    {
      id: "create-composition-focus",
      category: "Creating and Evaluating Art",
      question: "A learner wants viewers to notice a group protecting a historic site. Which composition would best focus attention on that action?",
      options: ["Place the group prominently and use lines or contrast to lead the eye toward them", "Place the group at the edge and make the surrounding buildings more prominent", "Use equal contrast everywhere so no action stands out", "Show the historic site clearly but crop out the people protecting it"],
      answer: 0,
      explanation: "Prominence and visual direction can guide attention to the most important action."
    },
    {
      id: "evaluate-cultural-accuracy",
      category: "Creating and Evaluating Art",
      question: "Before displaying an artwork based on a community's tradition, which feedback would be most useful?",
      options: ["Ask knowledgeable people from that community to review the context and representation", "Ask only whether the colors are bright", "Assume a classmate can speak for every community", "Avoid feedback so the artwork never needs revision"],
      answer: 0,
      explanation: "Feedback from knowledgeable community members can identify context or representation that needs care."
    },
    {
      id: "create-audience-plan",
      category: "Creating and Evaluating Art",
      question: "A group is planning an artwork about Filipino identity for younger students at a community exhibit. Which first step would best guide their artistic choices?",
      options: ["Agree on the message and audience, then choose imagery and a medium that communicate it clearly", "Select the most detailed medium before deciding what the artwork should say", "Copy a popular design and change its title to match the exhibit", "Choose several symbols first and assume every viewer will interpret them alike"],
      answer: 0,
      explanation: "Planning for the audience and message helps the group select a subject, style, symbols, and medium that work together."
    },
    {
      id: "create-six-concepts",
      category: "Creating and Evaluating Art",
      question: "A learner is planning an original artwork about Filipino identity. Which planning process best uses the six artistic concepts?",
      options: ["Choose what to show, its message, structure, visual approach, symbols, and materials", "Choose a subject and medium but leave the message and visual choices unplanned", "Select a theme and assume every symbol will communicate it automatically", "Copy a model artwork and change only its colors and title"],
      answer: 0,
      explanation: "Planning subject, theme, form, style, symbolism, and medium helps each choice support the intended identity and message."
    }
  ];

  // ========================================
  // LOCAL STORAGE
  // ========================================

  function defaultData() {
    return {
      history: [],
      awardedWeeks: [],
      seenQuestionIds: [],
      points: 0,
      petPoints: 0,
      activeAttempt: null
    };
  }

  function loadData() {
    try {
      const raw = localStorage.getItem(STORE);
      const saved = raw ? JSON.parse(raw) : null;

      if (saved && typeof saved === "object") {
        return {
          ...defaultData(),
          ...saved,
          history: Array.isArray(saved.history) ? saved.history : [],
          awardedWeeks: Array.isArray(saved.awardedWeeks)
            ? saved.awardedWeeks
            : [],
          seenQuestionIds: Array.isArray(saved.seenQuestionIds)
            ? saved.seenQuestionIds.filter((id) =>
                questions.some((question) => question.id === id)
              )
            : [],
          points: Number.isFinite(Number(saved.points))
            ? Number(saved.points)
            : 0,
          petPoints: Number.isFinite(Number(saved.petPoints))
            ? Number(saved.petPoints)
            : 0,
          activeAttempt: saved.activeAttempt &&
            typeof saved.activeAttempt === "object"
            ? saved.activeAttempt
            : null
        };
      }
    } catch (error) {
      console.warn("Could not load quiz data:", error);
    }

    return defaultData();
  }

  let data = loadData();

  let currentQuestion = 0;
  let correctCount = 0;
  let answers = [];
  let answerLocked = false;
  let activeAttempt = null;
  let advanceTimeout = null;

  function saveData() {
    try {
      localStorage.setItem(STORE, JSON.stringify(data));
      return true;
    } catch (error) {
      console.warn("Could not save quiz data:", error);
      $("weeklyQuizStatus").textContent =
        "Your quiz progress could not be saved in this browser.";
      return false;
    }
  }

  const DASHBOARD_STORE = "likhaDashboardPrototype_v1";
  const QUESTION_LIMIT = 5;

  const assessmentDetails = {
    week1: {
      title: "Week 1: Filipino Identity",
      topic: "Historical, cultural, and national perspectives",
      categories: [
        "Historical Filipino Identity",
        "Cultural Filipino Identity",
        "National Filipino Identity"
      ]
    },
    week2: {
      title: "Week 2: Subject & Theme",
      topic: "What an artwork shows and communicates",
      categories: ["Subject and Theme"]
    },
    week3: {
      title: "Week 3: Form & Style",
      topic: "Organization and artistic approach",
      categories: ["Form and Style"]
    },
    week4: {
      title: "Week 4: Symbolism & Medium",
      topic: "Meaning, materials, and tools",
      categories: ["Symbolism", "Medium and Materials"]
    },
    week5: {
      title: "Week 5: The Six Artistic Concepts",
      topic: "Applying subject, theme, form, style, symbolism, and medium",
      categories: null
    },
    week6: {
      title: "Week 6: Contemporary Filipino Art",
      topic: "Traditional inspiration, contemporary practice, and creative choices",
      categories: [
        "Traditional and Contemporary Filipino Art",
        "Creating and Evaluating Art"
      ]
    },
    "weekly-identity": {
      title: "My Filipino Identity: Art Challenge!",
      topic: "Filipino identity through visual arts",
      description:
        "Test your understanding of Filipino identity through visual arts. Explore subjects, themes, forms, styles, symbolism, and mediums, and discover how artworks express our history, culture, and national pride.",
      categories: null
    }
  };

  const requestedAssessment =
    new URLSearchParams(window.location.search).get("assessment");
  const assessmentId = Object.prototype.hasOwnProperty.call(
    assessmentDetails,
    requestedAssessment
  )
    ? requestedAssessment
    : "weekly-identity";
  const assessment = assessmentDetails[assessmentId];
  const questionPool = assessment.categories
    ? questions.filter((question) =>
        assessment.categories.includes(question.category)
      )
    : questions;

  function shuffle(items) {
    const shuffled = items.slice();

    for (let index = shuffled.length - 1; index > 0; index--) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] =
        [shuffled[swapIndex], shuffled[index]];
    }

    return shuffled;
  }

  function createAttemptId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }

    return `quiz-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function createQuestionSet() {
    let unseen = shuffle(
      questions.filter(
        (question) => !data.seenQuestionIds.includes(question.id)
      )
    );
    let selected = unseen
      .filter((question) => questionPool.includes(question))
      .slice(0, QUESTION_LIMIT);

    if (unseen.length < QUESTION_LIMIT) {
      selected = unseen;
      data.seenQuestionIds = [];
      unseen = shuffle(
        questions.filter(
          (question) => !selected.some((item) => item.id === question.id)
        )
      );
    }

    if (selected.length < QUESTION_LIMIT) {
      const selectedIds = new Set(
        selected.map((question) => question.id)
      );
      selected = selected.concat(
        unseen
          .filter((question) => !selectedIds.has(question.id))
          .slice(0, QUESTION_LIMIT - selected.length)
      );
    }

    return shuffle(selected)
      .map((question) => ({
        id: question.id,
        choices: shuffle(question.options.map((_, index) => index))
      }));
  }

  function conceptsForQuestion(question) {
    const conceptById = {
      "subject-theme-family": ["Subject", "Theme"],
      "subject-theme-community": ["Theme"],
      "subject-theme-disaster": ["Theme"],
      "subject-theme-interpret": ["Theme"],
      "subject-theme-change": ["Subject"],
      "form-composition": ["Form"],
      "form-emphasis": ["Form"],
      "style-folk-influence": ["Style"],
      "style-message-choice": ["Style"],
      "form-style-comparison": ["Form", "Style"],
      "create-family-theme": ["Subject", "Theme"],
      "evaluate-poster-clarity": ["Form"],
      "create-composition-focus": ["Form"]
    };

    if (conceptById[question.id]) return conceptById[question.id];
    if (question.category === "Symbolism" || question.id.startsWith("symbol-")) {
      return ["Symbolism"];
    }
    if (
      question.category === "Medium and Materials" ||
      question.id === "create-artwork-medium"
    ) {
      return ["Medium"];
    }
    if (
      question.id === "create-symbol-select" ||
      question.id === "evaluate-symbol-context"
    ) {
      return ["Symbolism"];
    }

    return [];
  }

  function loadDashboardState() {
    try {
      const raw = localStorage.getItem(DASHBOARD_STORE);
      const saved = LikhaPetProgress.reconcile(raw ? JSON.parse(raw) : {});

      if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
        throw new Error("Dashboard data is not an object.");
      }

      const savedPet =
        saved.pet && typeof saved.pet === "object"
          ? saved.pet
          : {};
      let legacyPet = null;

      if (!raw) {
        const legacyRaw = localStorage.getItem("likhaPet");
        if (legacyRaw) {
          try {
            legacyPet = JSON.parse(legacyRaw);
          } catch (error) {
            console.warn("Could not migrate legacy pet progress:", error);
          }
        }
      }

      const legacyType = localStorage.getItem("likhaSelectedPet");
      const stars = Number.isFinite(Number(saved.stars))
        ? Number(saved.stars)
        : 0;
      const shopPrices = {
        "pet-bow": 20,
        "artist-hat": 25,
        "star-background": 30,
        "pet-scarf": 35,
        "rainbow-shoes": 40,
        "festival-decor": 45
      };
      const knownShopSpending = Array.isArray(saved.purchasedItems)
        ? saved.purchasedItems.reduce(
            (total, itemId) => total + (shopPrices[itemId] || 0),
            0
          )
        : 0;
      const validPetTypes = [
        "rabbit",
        "cat",
        "dog",
        "lion",
        "panda",
        "tiger"
      ];

      return {
        ...saved,
        stars,
        totalStarsEarned: Number.isFinite(Number(saved.totalStarsEarned))
          ? Math.max(Number(saved.totalStarsEarned), stars)
          : stars + knownShopSpending,
        completedActivities: Array.isArray(saved.completedActivities)
          ? saved.completedActivities
          : [],
        quizResults: saved.quizResults &&
          typeof saved.quizResults === "object" &&
          !Array.isArray(saved.quizResults)
          ? saved.quizResults
          : {},
        quizRewardWeeks: Array.isArray(saved.quizRewardWeeks)
          ? saved.quizRewardWeeks
          : [],
        claimedPrizes: Array.isArray(saved.claimedPrizes)
          ? saved.claimedPrizes
          : [],
        pendingPrizes: Array.isArray(saved.pendingPrizes)
          ? saved.pendingPrizes
          : [],
        rewardHistory: Array.isArray(saved.rewardHistory)
          ? saved.rewardHistory
          : [],
        pet: {
          ...(legacyPet && typeof legacyPet === "object"
            ? {
              name: legacyPet.name || "Mimi",
                type: validPetTypes.includes(legacyType)
                  ? legacyType
                  : "cat",
                growthPoints: Math.max(
                  0,
                  (Number(legacyPet.points) || 0) * 2
                )
              }
            : {}),
          ...(saved.pet && typeof saved.pet === "object" ? saved.pet : {}),
          growthPoints: Number.isFinite(Number(savedPet.growthPoints))
            ? Number(savedPet.growthPoints)
            : legacyPet
              ? Math.max(0, (Number(legacyPet.points) || 0) * 2)
              : 0
        }
      };
    } catch (error) {
      console.error("Could not load dashboard quiz integration data:", error);
      return null;
    }
  }

  function isWeekRewarded(weekId) {
    const dashboard = loadDashboardState();

    return data.awardedWeeks.includes(weekId) ||
      Boolean(
        dashboard &&
        (
          dashboard.quizRewardWeeks.includes(weekId) ||
          dashboard.completedActivities.includes(
            `quiz:${assessmentId}:${weekId}`
          )
        )
      );
  }

  // ========================================
  // CURRENT WEEK
  // ========================================

  function getISOWeek(date = new Date()) {
    const d = new Date(
      Date.UTC(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      )
    );

    d.setUTCDate(
      d.getUTCDate() + 4 - (d.getUTCDay() || 7)
    );

    const year = d.getUTCFullYear();
    const start = new Date(Date.UTC(year, 0, 1));

    const week = Math.ceil(
      (((d - start) / 86400000) + 1) / 7
    );

    return `${year}-W${String(week).padStart(2, "0")}`;
  }

  const currentWeekId = getISOWeek();

  // ========================================
  // DISPLAY HELPERS
  // ========================================

  function showSection(id) {
    $(id).hidden = false;
  }

  function hideSection(id) {
    $(id).hidden = true;
  }

  function scrollToSection(id) {
    $(id).scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  // ========================================
  // DASHBOARD STATISTICS
  // ========================================

  function renderStats() {
    $("quizTotalPoints").textContent = data.points;

    $("lifetimeQuizPoints").textContent = data.points;

    $("completedQuizCount").textContent =
      data.history.length;

    const bestScore = data.history.length
      ? Math.max(
          ...data.history.map((item) => item.percentage)
        )
      : 0;

    $("bestQuizScore").textContent = bestScore + "%";

    $("quizBadgeCount").textContent =
      data.history.filter(
        (item) => item.percentage >= 70
      ).length;

    const historyList = $("quizHistoryList");

    historyList.replaceChildren();

    if (data.history.length === 0) {
      const empty = document.createElement("p");

      empty.className = "empty-state";

      empty.textContent =
        "Your quiz achievements will appear here after your first challenge!";

      historyList.appendChild(empty);
    } else {
      data.history
        .slice()
        .reverse()
        .slice(0, 12)
        .forEach((item) => {
          const entry = document.createElement("div");

          entry.className = "history-entry";

          const left = document.createElement("strong");

          left.textContent =
            `${item.week} • ${item.correct}/${item.total} correct`;

          const right = document.createElement("span");

          right.textContent =
            `${item.percentage}% • +${item.points} points`;

          entry.append(left, right);

          historyList.appendChild(entry);
        });
    }

    const alreadyAwarded = isWeekRewarded(currentWeekId);

    $("weeklyQuizStatus").textContent = alreadyAwarded
      ? "✓ This week's reward has been collected • New questions are practice-only"
      : "Ready to play • Correct answers can earn this week's rewards";

    $("questionRewardText").textContent = alreadyAwarded
      ? "Practice-only attempt • No additional rewards this week"
      : `Earn ${POINTS_PER_CORRECT} Quiz Points and ${PET_POINTS_PER_CORRECT} Pet Growth Points per correct answer`;
  }

  // ========================================
  // DISPLAY QUESTION
  // ========================================

  function renderQuestion() {
    const activeQuestion = activeAttempt.questions[currentQuestion];
    const question = questions.find(
      (item) => item.id === activeQuestion.id
    );
    const savedAnswer = activeAttempt.answers[currentQuestion];

    $("questionCounter").textContent =
      `Question ${currentQuestion + 1} of ${QUESTION_LIMIT}`;

    $("questionCategory").textContent =
      question.category;

    $("questionText").textContent =
      question.question;

    correctCount = activeAttempt.answers.filter(
      (answer) => answer && answer.correct
    ).length;

    $("liveScore").textContent = correctCount;

    const progress = Math.round(
      (currentQuestion / QUESTION_LIMIT) * 100
    );

    $("quizProgressFill").style.width =
      progress + "%";

    $("quizProgressBar").setAttribute(
      "aria-valuenow",
      String(progress)
    );

    $("answerFeedback").hidden = !savedAnswer;

    answerLocked = Boolean(savedAnswer);
    $("nextQuestionBtn").disabled = !savedAnswer;

    $("nextQuestionBtn").textContent =
      currentQuestion === QUESTION_LIMIT - 1
        ? "See Results →"
        : "Next Question →";

    $("questionImageWrap").hidden = true;

    const answerContainer = $("answerOptions");

    answerContainer.replaceChildren();

    activeQuestion.choices.forEach((optionIndex, displayIndex) => {
      const button = document.createElement("button");

      button.type = "button";
      button.className = "answer-option";
      button.textContent = `${"ABCD"[displayIndex]}. ${question.options[optionIndex]}`;
      button.disabled = Boolean(savedAnswer);

      button.addEventListener("click", () => {
        selectAnswer(displayIndex);
      });

      answerContainer.appendChild(button);
    });

    if (savedAnswer) {
      const correctDisplayIndex =
        activeQuestion.choices.indexOf(question.answer);

      [...answerContainer.children].forEach((button, index) => {
        if (index === correctDisplayIndex) {
          button.classList.add("correct");
        } else if (index === savedAnswer.selectedIndex) {
          button.classList.add("incorrect");
        }
      });

      $("feedbackTitle").textContent = savedAnswer.correct
        ? "🌟 Wonderful! Correct answer!"
        : "💡 Nice try! Keep learning!";
      $("feedbackText").textContent =
        `Correct answer: ${question.options[question.answer]}. ${question.explanation}`;
      $("answerFeedback").hidden = false;
    }

    $("questionRewardText").textContent = isWeekRewarded(currentWeekId)
      ? "Practice-only attempt • No additional rewards this week"
      : `Earn ${POINTS_PER_CORRECT} Quiz Points and ${PET_POINTS_PER_CORRECT} Pet Growth Points per correct answer`;
  }

  // ========================================
  // CHECK ANSWER
  // ========================================

  function selectAnswer(selectedIndex) {
    if (answerLocked) return;

    answerLocked = true;

    const activeQuestion = activeAttempt.questions[currentQuestion];
    const question = questions.find(
      (item) => item.id === activeQuestion.id
    );
    const selectedOptionIndex =
      activeQuestion.choices[selectedIndex];

    const isCorrect =
      selectedOptionIndex === question.answer;

    const answer = {
      questionId: question.id,
      question: question.question,
      selectedIndex,
      chosen: question.options[selectedOptionIndex],
      correctAnswer: question.options[question.answer],
      correct: isCorrect,
      explanation: question.explanation
    };

    activeAttempt.answers[currentQuestion] = answer;
    answers = activeAttempt.answers;

    if (!data.seenQuestionIds.includes(question.id)) {
      data.seenQuestionIds.push(question.id);
    }

    const buttons = [
      ...$("answerOptions").children
    ];
    const correctDisplayIndex =
      activeQuestion.choices.indexOf(question.answer);

    buttons.forEach((button, index) => {
      button.disabled = true;

      if (index === correctDisplayIndex) {
        button.classList.add("correct");
      } else if (index === selectedIndex) {
        button.classList.add("incorrect");
      }
    });

    $("feedbackTitle").textContent = isCorrect
      ? "🌟 Wonderful! Correct answer!"
      : "💡 Nice try! Keep learning!";

    $("feedbackText").textContent =
      `Correct answer: ${question.options[question.answer]}. ${question.explanation}`;

    $("answerFeedback").hidden = false;

    correctCount = activeAttempt.answers.filter(
      (item) => item && item.correct
    ).length;
    $("liveScore").textContent = correctCount;

    $("nextQuestionBtn").disabled = false;
    saveData();

    clearTimeout(advanceTimeout);
    advanceTimeout = setTimeout(advanceQuestion, 1800);
  }

  // ========================================
  // START QUIZ
  // ========================================

  function startQuiz() {
    clearTimeout(advanceTimeout);
    currentQuestion = 0;
    correctCount = 0;
    answers = [];
    activeAttempt = {
      id: createAttemptId(),
      assessmentId,
      week: currentWeekId,
      questions: createQuestionSet(),
      answers: [],
      currentIndex: 0
    };
    data.activeAttempt = activeAttempt;

    $("gameQuizTitle").textContent = assessment.title;
    saveData();

    hideSection("quizResultsSection");
    showSection("quizGameSection");

    renderQuestion();

    scrollToSection("quizGameSection");
  }

  // ========================================
  // FINISH QUIZ
  // ========================================

  function syncDashboardAttempt(attemptRecord, badge) {
    const dashboard = loadDashboardState();

    if (!dashboard) {
      return {
        saved: false,
        rewarded: false
      };
    }

    const attempts = Array.isArray(dashboard.quizResults[assessmentId])
      ? dashboard.quizResults[assessmentId]
      : [];
    const previousAttempt = attempts.find(
      (item) => item.attemptId === attemptRecord.attemptId
    );

    if (previousAttempt) {
      return {
        saved: true,
        rewarded: Boolean(previousAttempt.rewarded),
        points: Number(previousAttempt.points) || 0,
        petPoints: Number(previousAttempt.petPoints) || 0
      };
    }

    const taskId = `quiz:${assessmentId}:${currentWeekId}`;
    const alreadyRewarded = isWeekRewarded(currentWeekId) ||
      dashboard.quizRewardWeeks.includes(currentWeekId) ||
      dashboard.completedActivities.includes(taskId) ||
      dashboard.completedActivities.includes(`quiz:${assessmentId}`);
    const rewarded = !alreadyRewarded;
    const earnedPoints = rewarded
      ? attemptRecord.correct * POINTS_PER_CORRECT
      : 0;
    const earnedPetPoints = rewarded
      ? attemptRecord.correct * PET_POINTS_PER_CORRECT
      : 0;
    const savedAttempt = {
      ...attemptRecord,
      points: earnedPoints,
      petPoints: earnedPetPoints,
      rewarded
    };

    attempts.push(savedAttempt);
    dashboard.quizResults[assessmentId] = attempts;

    if (!dashboard.quizRewardWeeks.includes(currentWeekId)) {
      dashboard.quizRewardWeeks.push(currentWeekId);
    }

    if (rewarded) {
      if (!dashboard.completedActivities.includes(taskId)) {
        dashboard.completedActivities.push(taskId);
      }

      dashboard.stars += earnedPoints;
      dashboard.totalStarsEarned =
        Math.max(Number(dashboard.totalStarsEarned) || 0, dashboard.stars - earnedPoints) +
        earnedPoints;
      dashboard.pet.growthPoints += earnedPetPoints;
    }

    if (
      !dashboard.rewardHistory.some(
        (item) => item.attemptId === attemptRecord.attemptId
      )
    ) {
      dashboard.rewardHistory.unshift({
        id: attemptRecord.attemptId,
        attemptId: attemptRecord.attemptId,
        icon: badge[0],
        title: rewarded ? "Weekly quiz completed" : "Quiz practice completed",
        description:
          `${assessment.title}: ${attemptRecord.correct}/${attemptRecord.total} correct (${attemptRecord.percentage}%).`,
        value: rewarded
          ? `+${earnedPoints} Quiz Points · +${earnedPetPoints} Pet Growth Points`
          : "Practice only · no additional rewards",
        date: new Date().toLocaleDateString()
      });
      dashboard.rewardHistory =
        dashboard.rewardHistory.slice(0, 30);
    }

    try {
      localStorage.setItem(
        DASHBOARD_STORE,
        JSON.stringify(dashboard)
      );
    } catch (error) {
      console.error("Could not save dashboard quiz rewards:", error);
      return {
        saved: false,
        rewarded: false
      };
    }

    return {
      saved: true,
      rewarded,
      points: earnedPoints,
      petPoints: earnedPetPoints
    };
  }

  function finishQuiz() {
    if (!activeAttempt || activeAttempt.completed) return;

    hideSection("quizGameSection");
    showSection("quizResultsSection");

    activeAttempt.completed = true;
    correctCount = activeAttempt.answers.filter(
      (answer) => answer && answer.correct
    ).length;
    answers = activeAttempt.answers;

    const percentage = Math.round(
      (correctCount / QUESTION_LIMIT) * 100
    );
    const questionResults = activeAttempt.answers
      .filter(Boolean)
      .map((answer) => {
        const question = questions.find(
          (item) => item.id === answer.questionId
        );

        return question
          ? {
              questionId: question.id,
              category: question.category,
              concepts: conceptsForQuestion(question),
              correct: Boolean(answer.correct)
            }
          : null;
      })
      .filter(Boolean);

    let badge;

    if (percentage >= 80) {
      badge = [
        "🏆",
        "Culture Champion",
        "You showed excellent knowledge of Filipino creativity!"
      ];
    } else if (percentage >= 50) {
      badge = [
        "🥈",
        "Creative Learner",
        "You are growing your artistic knowledge!"
      ];
    } else {
      badge = [
        "🌱",
        "Creative Explorer",
        "Every new discovery counts!"
      ];
    }

    const syncResult = syncDashboardAttempt({
      attemptId: activeAttempt.id,
      assessmentId,
      week: currentWeekId,
      date: new Date().toISOString(),
      correct: correctCount,
      total: QUESTION_LIMIT,
      score: percentage,
      percentage,
      questionResults
    }, badge);
    const rewarded = syncResult.saved && syncResult.rewarded;
    const earnedPoints = rewarded ? syncResult.points : 0;
    const earnedPetPoints = rewarded ? syncResult.petPoints : 0;

    if (syncResult.saved && !data.awardedWeeks.includes(currentWeekId)) {
      data.awardedWeeks.push(currentWeekId);
      data.points += earnedPoints;
      data.petPoints += earnedPetPoints;
    }

    data.history.push({
      attemptId: activeAttempt.id,
      assessmentId,
      title: assessment.title,
      week: currentWeekId,
      date: new Date().toISOString(),
      correct: correctCount,
      total: QUESTION_LIMIT,
      percentage,
      questionResults,
      points: earnedPoints,
      petPoints: earnedPetPoints,
      rewarded
    });

    activeAttempt.completed = true;
    data.activeAttempt = null;
    saveData();
    renderStats();

    // Display results
    $("resultPercentage").textContent =
      percentage + "%";

    $("resultCorrect").textContent =
      correctCount;

    $("resultTotal").textContent =
      QUESTION_LIMIT;

    $("resultPoints").textContent =
      "+" + earnedPoints;

    $("resultPetPoints").textContent =
      "+" + earnedPetPoints;

    if (percentage >= 80) {
      $("resultHeading").textContent =
        "🏆 Outstanding, LIKHA Artist!";
    } else if (percentage >= 50) {
      $("resultHeading").textContent =
        "🌟 Great effort, creator!";
    } else {
      $("resultHeading").textContent =
        "🎨 Keep exploring and learning!";
    }

    if (!syncResult.saved) {
      $("resultMessage").textContent =
        "Your answers are ready, but LIKHA could not save this result or its rewards. Please check browser storage before starting another quiz.";
    } else if (rewarded) {
      $("resultMessage").textContent =
        "Your first completed assessment this week earned Quiz Points and helped your pet grow!";
    } else {
      $("resultMessage").textContent =
        "Practice complete! This attempt did not earn additional rewards because this week's reward has already been collected.";
    }

    $("resultBadgeIcon").textContent = badge[0];
    $("resultBadgeTitle").textContent = badge[1];
    $("resultBadgeDescription").textContent = badge[2];

    // ========================================
    // ANSWER REVIEW
    // ========================================

    const reviewList = $("answerReviewList");

    reviewList.replaceChildren();

    answers.forEach((answer, index) => {
      const card = document.createElement("div");

      card.className = "review-item";

      const heading = document.createElement("strong");

      heading.textContent =
        `${index + 1}. ${answer.question}`;

      const chosen = document.createElement("p");

      chosen.className =
        answer.correct ? "right" : "wrong";

      chosen.textContent =
        `${answer.correct ? "✓" : "✗"} Your answer: ${answer.chosen}`;

      const correctAnswer = document.createElement("p");

      correctAnswer.textContent =
        `Correct answer: ${answer.correctAnswer}`;

      const explanation = document.createElement("p");

      explanation.textContent =
        answer.explanation;

      card.append(
        heading,
        chosen,
        correctAnswer,
        explanation
      );

      reviewList.appendChild(card);
    });

    window.dispatchEvent(
      new CustomEvent("likha:quiz-complete", {
        detail: {
          week: currentWeekId,
          score: correctCount,
          total: QUESTION_LIMIT,
          points: earnedPoints,
          petPoints: earnedPetPoints,
          rewarded,
          attemptId: activeAttempt.id
        }
      })
    );

    scrollToSection("quizResultsSection");
  }

  function advanceQuestion() {
    clearTimeout(advanceTimeout);

    if (!activeAttempt || !activeAttempt.answers[currentQuestion]) {
      return;
    }

    currentQuestion++;
    activeAttempt.currentIndex = currentQuestion;
    data.activeAttempt = activeAttempt;
    saveData();

    if (currentQuestion < QUESTION_LIMIT) {
      renderQuestion();
    } else {
      finishQuiz();
    }
  }

  function restoreActiveAttempt() {
    const savedAttempt = data.activeAttempt;

    if (
      !savedAttempt ||
      savedAttempt.assessmentId !== assessmentId ||
      savedAttempt.week !== currentWeekId ||
      !Array.isArray(savedAttempt.questions) ||
      savedAttempt.questions.length !== QUESTION_LIMIT ||
      savedAttempt.questions.some(
        (item) =>
          !questions.some((question) => question.id === item.id) ||
          !Array.isArray(item.choices) ||
          item.choices.length !== 4 ||
          new Set(item.choices).size !== 4 ||
          item.choices.some((choice) =>
            !Number.isInteger(choice) || choice < 0 || choice > 3
          )
      )
    ) {
      data.activeAttempt = null;
      saveData();
      return false;
    }

    activeAttempt = savedAttempt;
    activeAttempt.answers = Array.isArray(savedAttempt.answers)
      ? savedAttempt.answers
      : [];
    currentQuestion = Math.min(
      Number(savedAttempt.currentIndex) || 0,
      QUESTION_LIMIT - 1
    );
    answers = activeAttempt.answers;

    $("gameQuizTitle").textContent = assessment.title;
    hideSection("weeklyChallenge");
    hideSection("quizResultsSection");
    showSection("quizGameSection");
    renderQuestion();

    if (activeAttempt.answers[currentQuestion]) {
      advanceTimeout = setTimeout(advanceQuestion, 1800);
    }

    return true;
  }

  // ========================================
  // BUTTON EVENTS
  // ========================================

  $("startQuizBtn").addEventListener(
    "click",
    startQuiz
  );

  $("retryQuizBtn").addEventListener(
    "click",
    startQuiz
  );

  $("nextQuestionBtn").addEventListener(
    "click",
    () => {
      if (!answerLocked) return;
      advanceQuestion();
    }
  );

  $("exitQuizBtn").addEventListener(
    "click",
    () => {
      const shouldExit = confirm(
        "Leave this attempt? Your answered questions will remain in your history, but the incomplete attempt will end."
      );

      if (shouldExit) {
        clearTimeout(advanceTimeout);
        activeAttempt = null;
        data.activeAttempt = null;
        saveData();
        hideSection("quizGameSection");
        showSection("weeklyChallenge");
        scrollToSection("weeklyChallenge");
      }
    }
  );

  // ========================================
  // MOBILE NAVIGATION
  // ========================================

  $("menuToggle").addEventListener(
    "click",
    () => {
      const isOpen = $("navLinks").classList.toggle("open");

      $("menuToggle").setAttribute(
        "aria-expanded",
        String(isOpen)
      );
    }
  );

  // ========================================
  // CREATIVE LAB CONNECTIONS
  // ========================================

  document
    .querySelectorAll("[data-open-lab]")
    .forEach((link) => {
      link.addEventListener("click", () => {
        try {
          localStorage.setItem(
            "selectedLab",
            link.dataset.openLab
          );
        } catch (error) {
          console.warn("Could not save lab selection:", error);
        }
      });
    });

  // ========================================
  // INITIALIZE PAGE
  // ========================================

  $("quizQuestionCount").textContent =
    QUESTION_LIMIT;

  $("weeklyQuizTitle").textContent = assessment.title;
  $("weeklyQuizDescription").textContent =
    assessment.description ||
    `${assessment.topic}. Complete five scenario-based questions, explore the explanations, and connect your choices to Filipino identity through visual arts.`;

  $("currentWeekLabel").textContent =
    "Week " +
    currentWeekId.split("W")[1] +
    " • " +
    currentWeekId.slice(0, 4);

  $("currentYear").textContent =
    new Date().getFullYear();

  // Connect the quiz profile to existing learner data when available.
  try {
    const dashboard = loadDashboardState();
    const learnerName =
      localStorage.getItem("likhaUsername") ||
      localStorage.getItem("username") ||
      (dashboard && dashboard.avatar && dashboard.avatar.name) ||
      (dashboard && dashboard.studentName);

    if (learnerName) {
      $("quizLearnerName").textContent =
        learnerName;
    }

    if (dashboard && dashboard.avatar && dashboard.avatar.face) {
      $("quizAvatar").textContent = dashboard.avatar.face;
    }
  } catch (error) {
    console.warn("Could not load learner name:", error);
  }

  renderStats();
  restoreActiveAttempt();

})();
