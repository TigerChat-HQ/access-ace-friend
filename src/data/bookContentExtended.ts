import type { BookChapter } from "./bookContentPhase1";

// Awamu ya pili ya mwongozo: sura za uchambuzi, matumizi na hitimisho.
// Hizi ni nyongeza za kielimu; si nakala kamili za vitabu au sheria.
const extensions: Record<string, [string, string, string, string]> = {
  "romeo-juliet": ["Mtazamo wa wahusika na maamuzi", "Lugha, ishara na mandhari", "Migogoro na matokeo yake", "Urithi wa tamthilia"],
  "pride-prejudice": ["Tabaka, mali na nafasi ya wanawake", "Saikolojia ya hukumu za haraka", "Ndoa, familia na matarajio", "Ucheshi na ukosoaji wa jamii"],
  "hadithi-za-moto": ["Ujenzi wa wahusika na simulizi", "Methali, ishara na maadili", "Suluhisho la migogoro ya jamii", "Jinsi ya kutunga hadithi zako"],
  "republic": ["Haki kwa mtu na kwa jamii", "Mfano wa pango na maarifa", "Aina za utawala na udhaifu wake", "Maswali ya kuisoma dunia ya leo"],
  "prince": ["Aina za dola na namna ya kuzidumisha", "Jeshi, usalama na taasisi", "Sifa, hofu na ridhaa ya wananchi", "Machiavelli katika mjadala wa leo"],
  "mandela": ["Familia, utamaduni na elimu", "Harakati na mikakati ya upinzani", "Gereza na mshikamano wa kimataifa", "Uongozi, maridhiano na changamoto"],
  "mansa-musa": ["Dola ya Mali na utawala", "Hija na mitandao ya biashara", "Timbuktu, elimu na utamaduni", "Urithi na vyanzo vya historia"],
  "alexandria": ["Msingi wa mji na bandari", "Maktaba na uzalishaji wa maarifa", "Sayansi, lugha na tamaduni", "Kumbukumbu na mipaka ya ushahidi"],
  "kilwa": ["Uchumi wa miji ya Waswahili", "Jahazi, monsuni na biashara", "Usanifu, dini na maisha ya kila siku", "Akiolojia na uhifadhi wa urithi"],
  "biblia-guide": ["Muundo wa Agano la Kale na Jipya", "Aina za maandiko na muktadha", "Mada kuu na uhusiano wa vitabu", "Mbinu ya kusoma na kulinganisha tafsiri"],
  "quran-guide": ["Muundo wa sura na mpangilio wa msahafu", "Muktadha na mada za sura", "Maadili na ujumbe mkuu", "Adabu za usomaji na rejea za tafsiri"],
  "katiba-tanzania": ["Muundo wa Katiba na mamlaka ya dola", "Haki, wajibu na uhuru wa msingi", "Bunge, Serikali na Mahakama", "Marekebisho, tafsiri na matumizi"],
  "law-child": ["Wajibu wa wazazi na walezi", "Ulinzi dhidi ya ukatili na unyonyaji", "Elimu, afya na haki za mtoto", "Taratibu, taasisi na utekelezaji"],
  "cybercrimes-act": ["Mifumo ya kompyuta na makosa", "Uchunguzi na ushahidi wa kielektroniki", "Faragha, mamlaka na haki za mtumiaji", "Uzingatiaji wa sheria na usalama"],
  "employment-act": ["Mikataba na masharti ya ajira", "Haki za msingi na usawa kazini", "Vyama, majadiliano na migogoro", "Taratibu za malalamiko na marejeo"],
  "education-act": ["Muundo wa mfumo wa elimu", "Wajibu wa taasisi na wadau", "Usimamizi, viwango na uwajibikaji", "Utekelezaji na mabadiliko ya sera"],
  "copyright-act": ["Umiliki na muda wa ulinzi", "Matumizi halali na mipaka ya ruhusa", "Leseni, ukiukaji na tiba", "Ulinzi wa kazi katika mazingira ya kidijitali"],
  "penal-code": ["Vipengele vya kosa la jinai", "Nia, uzembe na utetezi", "Makundi ya makosa na adhabu", "Mchakato, haki na marejeo rasmi"],
  "learning-science": ["Kumbukumbu na kujifunza kwa vipindi", "Kujipima na mrejesho", "Usingizi, umakini na mazingira", "Mpango wa kujifunza na kujitathmini"],
  "earth-science": ["Muundo wa ndani wa Dunia", "Mzunguko, mhimili na misimu", "Maji, angahewa na hali ya hewa", "Mabadiliko ya tabianchi na sayansi ya uchunguzi"],
  "digital-safety": ["Nywila, uthibitishaji na vifaa", "Ulaghai, phishing na viungo", "Faragha, ruhusa na data", "Mpango wa kujibu tukio la usalama"],
  "sleepy-hollow": ["Hadithi za kijiji na mazingira", "Ichabod, Brom na Katrina", "Hofu, uvumi na utata wa mwisho", "Urithi wa simulizi la Irving"],
  "dracula": ["Muundo wa barua na shajara", "Kasri, safari na tishio", "Ushirikiano na mbinu za wahusika", "Hofu, sayansi na jamii ya wakati huo"],
  "frankenstein": ["Victor na tamaa ya maarifa", "Kiumbe, upweke na utu", "Wajibu wa muumbaji na matokeo", "Sayansi, maadili na tafsiri za riwaya"],
  "sherlock": ["Ushahidi na mbinu ya Holmes", "Mary Morstan na historia ya hazina", "Ufuatiliaji na utatuzi wa fumbo", "Mantiki, upendeleo na mipaka ya upelelezi"],
  "odyssey": ["Muundo wa safari na usimulizi", "Wageni, majaribu na ukarimu", "Penelope, Telemachus na nyumbani", "Mashujaa, miungu na maana ya kurudi"],
  "art-of-war": ["Tathmini ya mazingira na mipango", "Taarifa, ujasusi na kutokuwa na uhakika", "Uongozi, nidhamu na uratibu", "Gharama za vita na matumizi ya kimaadili"],
  "julius-caesar": ["Jamhuri ya Roma na taasisi", "Vita vya Gaul na umaarufu", "Rubicon, mamlaka na upinzani", "Mauaji na mwisho wa Jamhuri"],
  "timbuktu": ["Njia za Sahara na uchumi", "Wasomi, madrasa na misikiti", "Maktaba na uhifadhi wa miswada", "Changamoto za urithi na utafiti"],
  "zanzibar": ["Bahari ya Hindi na jamii za pwani", "Stone Town na usanifu", "Karafuu, utumwa na ukoloni", "Mapinduzi, Muungano na kumbukumbu"],
  "kilwa-history": ["Miji, jamii na mamlaka ya pwani", "Biashara na mahusiano ya kimataifa", "Akiolojia na ushahidi wa majengo", "Urithi wa dunia na wajibu wa uhifadhi"],
  "don-quixote": ["Vitabu vya ushujaa na fikra za Don Quixote", "Ucheshi, kejeli na uhalisia", "Sancho Panza na urafiki", "Ndoto, utu na tafsiri ya mwisho"]
};

const studyPrompts = [
  "Soma sura hii ukitafuta sababu na matokeo, kisha linganisha hoja kuu na mifano iliyotolewa katika sura zilizotangulia.",
  "Tenganisha ukweli, tafsiri na maoni. Andika ushahidi unaounga mkono kila hitimisho na tambua maswali ambayo bado hayajajibiwa.",
  "Tumia maarifa ya sura hii kuchambua hali halisi. Eleza mipaka ya mfano huo na epuka kuhamisha hitimisho bila kuangalia muktadha.",
  "Rudia mawazo muhimu, tengeneza muhtasari kwa maneno yako na eleza jambo moja unalotaka kulichunguza zaidi."
];

export const BOOK_CONTENT_EXTENDED: Record<string, BookChapter[]> = Object.fromEntries(
  Object.entries(extensions).map(([bookId, titles]) => [
    bookId,
    titles.map((title, index) => ({
      title,
      paragraphs: [
        `Sura hii inapanua mwongozo wa kitabu kwa kuchunguza ${title.toLowerCase()}. Iunganishe mada hii na wahusika, matukio au dhana zilizoelezwa katika sura nne za mwanzo. Zingatia muktadha wa wakati na mahali, sababu zilizochochea jambo, na matokeo yake kwa watu au jamii.`,
        `${studyPrompts[index]} Kwa mada za historia, linganisha vyanzo na tambua pale ushahidi unapokuwa na mipaka. Kwa maandiko ya dini, rejea matini na tafsiri unayoitumia badala ya kuchukulia mwongozo huu kuwa maandiko yenyewe. Kwa sheria, hakiki kifungu na marekebisho katika chanzo rasmi cha Tanzania; maelezo haya si ushauri wa kisheria.`
      ],
      reflection: [
        "Ni hoja gani kuu ya sura hii, na ushahidi gani unaithibitisha?",
        "Ni mtazamo gani mwingine ungeweza kutoa tafsiri tofauti ya mada hii?",
        "Ni matokeo gani ya muda mfupi na mrefu yanayoweza kutokana na jambo lililojadiliwa?",
        "Unawezaje kueleza somo kuu la kitabu kwa maneno yako na kulitumia kwa uwajibikaji?"
      ][index]
    }))
  ])
);
