import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, Bookmark, CalendarDays, Check, ChevronRight, Clock3, ExternalLink, Filter, Heart, Library, Search, Settings2, Sparkles, Type, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

type Book = {
  id: string;
  title: string;
  author: string;
  category: string;
  description: string;
  year: string;
  readTime: string;
  cover: string;
  symbol: string;
  sample: string;
  kind?: "guide" | "fiction";
  fullTextUrl?: string;
  fullTextLabel?: string;
  sourceReference?: string;
};

const categories = [
  { id: "all", label: "Vyote", icon: "📚" },
  { id: "mapenzi", label: "Mapenzi", icon: "❤️" },
  { id: "stori", label: "Hadithi", icon: "📖" },
  { id: "siasa", label: "Siasa za zamani", icon: "🏛️" },
  { id: "mashujaa", label: "Mashujaa", icon: "🛡️" },
  { id: "miji", label: "Miji duniani", icon: "🌍" },
  { id: "dini", label: "Biblia na Qurani", icon: "🕊️" },
  { id: "kutisha", label: "Vitisho vya kale", icon: "🌒" },
  { id: "elimu", label: "Elimu", icon: "🎓" },
  { id: "sheria", label: "Sheria", icon: "⚖️" },
];

const books: Book[] = [
  { id: "romeo-juliet", title: "Romeo na Julieta", author: "William Shakespeare", category: "mapenzi", description: "Mapenzi ya vijana wawili kutoka familia zinazochukiana. Hadithi ya uamuzi, uaminifu na gharama ya chuki.", year: "1597", readTime: "Dakika 18", cover: "from-rose-950 via-red-900 to-amber-950", symbol: "🌹", sample: "Katika mji wa Verona, majina ya familia mbili yalitosha kuwasha ugomvi. Lakini usiku mmoja, macho mawili yalikutana na kuanza hadithi ambayo hakuna upande uliokuwa tayari kuikubali.", fullTextUrl: "https://www.gutenberg.org/ebooks/1513", fullTextLabel: "Soma nakala kamili (Kiingereza · Project Gutenberg)" },
  { id: "pride-prejudice", title: "Fahari na Upendeleo", author: "Jane Austen", category: "mapenzi", description: "Mahusiano, matarajio ya jamii na namna hukumu za haraka zinavyoweza kuficha ukweli wa moyo.", year: "1813", readTime: "Dakika 20", cover: "from-pink-950 via-fuchsia-900 to-slate-950", symbol: "💌", sample: "Katika jamii iliyopima watu kwa majina na mali, Elizabeth aliamua kuamini akili yake. Lakini je, akili inaweza kutambua moyo kabla ya kiburi kuzungumza?", fullTextUrl: "https://www.gutenberg.org/ebooks/1342", fullTextLabel: "Soma nakala kamili (Kiingereza · Project Gutenberg)" },
  { id: "hadithi-za-moto", title: "Hadithi za Moto wa Kijijini", author: "Mkusanyo wa simulizi", category: "stori", description: "Simulizi za kubuni zenye mafunzo, siri za familia, urafiki na maamuzi yanayobadilisha maisha.", year: "Mkusanyo", readTime: "Dakika 12", cover: "from-orange-950 via-amber-800 to-stone-950", symbol: "🔥", sample: "Wazee walikusanyika kuzunguka moto. Kila mmoja alikuwa na simulizi, lakini usiku huo kulikuwa na hadithi moja ambayo hakuna aliyethubutu kuimaliza." },
  { id: "republic", title: "Jamhuri", author: "Plato", category: "siasa", description: "Mazungumzo ya kale kuhusu haki, uongozi, elimu na jamii bora. Muhtasari wa mawazo yake kwa Kiswahili.", year: "Karne ya 4 KK", readTime: "Dakika 22", cover: "from-stone-900 via-slate-700 to-amber-950", symbol: "🏛️", sample: "Ni nini haki? Je, mtawala bora hutafuta faida yake au ustawi wa watu? Maswali haya yaliwekwa mezani katika mazungumzo yaliyovuka karne nyingi.", fullTextUrl: "https://www.gutenberg.org/ebooks/1497", fullTextLabel: "Soma nakala kamili (Kiingereza · Project Gutenberg)" },
  { id: "prince", title: "Mfalme", author: "Niccolò Machiavelli", category: "siasa", description: "Mawazo ya kihistoria kuhusu mamlaka, diplomasia na uongozi katika Italia ya zamani.", year: "1532", readTime: "Dakika 16", cover: "from-zinc-950 via-stone-800 to-red-950", symbol: "👑", sample: "Katika enzi ya falme zilizobadilika kwa kasi, uongozi haukuwa suala la taji pekee. Uamuzi mmoja ungeweza kuokoa ufalme au kuuangusha.", fullTextUrl: "https://www.gutenberg.org/ebooks/1232", fullTextLabel: "Soma nakala kamili (Kiingereza · Project Gutenberg)" },
  { id: "mandela", title: "Safari ya Uhuru", author: "Wasifu wa kihistoria", category: "mashujaa", description: "Safari ya Nelson Mandela, mapambano dhidi ya ubaguzi na nguvu ya msamaha katika historia ya Afrika Kusini.", year: "Karne ya 20", readTime: "Dakika 15", cover: "from-emerald-950 via-green-800 to-yellow-950", symbol: "✊🏿", sample: "Uhuru haukuja kwa siku moja. Ulijengwa kwa subira, mshikamano na watu waliokataa kuamini kwamba ubaguzi ungekuwa mwisho wa hadithi yao." },
  { id: "mansa-musa", title: "Mansa Musa na Dola ya Mali", author: "Historia ya Afrika", category: "mashujaa", description: "Historia ya mtawala wa Mali, safari yake maarufu ya hija na ustawi wa Timbuktu kama kitovu cha elimu.", year: "Karne ya 14", readTime: "Dakika 14", cover: "from-yellow-950 via-amber-700 to-stone-950", symbol: "🕌", sample: "Misafara ilipovuka Sahara, habari za utajiri na elimu ya Mali zilifika mbali. Lakini urithi mkubwa wa dola haukuwa dhahabu pekee." },
  { id: "alexandria", title: "Alexandria: Mji wa Maarifa", author: "Mfululizo wa miji", category: "miji", description: "Safari ya kihistoria katika Alexandria, maktaba yake ya kale, bandari na mikutano ya tamaduni.", year: "Historia ya kale", readTime: "Dakika 13", cover: "from-cyan-950 via-sky-800 to-stone-950", symbol: "🏺", sample: "Meli zilifika kutoka pande nyingi za bahari. Katika mitaa ya Alexandria, lugha, biashara na mawazo mapya vilikutana kila siku." },
  { id: "kilwa", title: "Kilwa Kisiwani na Miji ya Waswahili", author: "Historia ya Afrika Mashariki", category: "miji", description: "Historia ya miji ya pwani ya Afrika Mashariki, biashara ya bahari, usanifu na utamaduni wa Kiswahili.", year: "Karne za kati", readTime: "Dakika 17", cover: "from-teal-950 via-emerald-800 to-amber-950", symbol: "⛵", sample: "Upepo wa bahari ulileta jahazi bandarini. Bidhaa, habari na lugha zilisafiri pamoja na wafanyabiashara waliounganisha pwani na dunia." },
  { id: "biblia-guide", title: "Biblia: Mwongozo wa Vitabu na Mada", author: "Mwongozo wa usomaji", category: "dini", description: "Ramani ya vitabu vya Biblia, wahusika, historia na mada za kutafakari. Chagua kitabu na usome kutoka tafsiri uliyo nayo.", year: "Mwongozo", readTime: "Dakika 10", cover: "from-amber-950 via-yellow-800 to-stone-950", symbol: "✝️", sample: "Mwongozo huu unakusaidia kuchagua sehemu ya kusoma, kuelewa muktadha wake wa kihistoria na kufuatilia mada kama hekima, huruma na matumaini.", kind: "guide" },
  { id: "quran-guide", title: "Qurani: Mwongozo wa Sura na Mada", author: "Mwongozo wa usomaji", category: "dini", description: "Mwongozo wa mada na sura za Qurani kwa Kiswahili. Kwa matini kamili, tumia tafsiri unayoamini na rejea zake sahihi.", year: "Mwongozo", readTime: "Dakika 10", cover: "from-emerald-950 via-teal-800 to-slate-950", symbol: "☪️", sample: "Mwongozo huu unaelekeza msomaji katika mada za rehema, subira, uadilifu na shukrani, bila kubadilisha au kudai kuwa ni matini ya Qurani.", kind: "guide" },
  { id: "katiba-tanzania", title: "Katiba ya Jamhuri ya Muungano", author: "Jamhuri ya Muungano wa Tanzania", category: "sheria", description: "Rejea ya Katiba ya Jamhuri ya Muungano. Fungua mfumo rasmi wa NaLIS kusoma au kupakua Katiba kamili kwa Kiswahili au Kiingereza.", year: "1977 · Toleo rasmi la sasa", readTime: "Hati rasmi", cover: "from-amber-950 via-stone-800 to-emerald-950", symbol: "⚖️", sample: "Hii ni rejea ya Katiba rasmi. Soma matini yote kwenye mfumo wa kitaifa wa taarifa za sheria ili kutumia toleo sahihi.", fullTextUrl: "https://nalis.sheria.go.tz/en/constitution", fullTextLabel: "Soma Katiba kwa Kiswahili au Kiingereza (NaLIS)", sourceReference: "NaLIS — Katiba ya Jamhuri ya Muungano wa Tanzania" },
  { id: "law-child", title: "Sheria ya Mtoto, Sura ya 13", author: "Ofisi ya Mwanasheria Mkuu", category: "sheria", description: "Sheria ya Mtoto ya 2009 (Na. 21 ya 2009), iliyorekebishwa na kuchapishwa upya Aprili 2025. Inahusu haki, ulinzi na ustawi wa mtoto.", year: "2009 · Toleo lililorekebishwa 2025", readTime: "Hati rasmi", cover: "from-sky-950 via-blue-800 to-amber-900", symbol: "🧒", sample: "Maelezo rasmi ya sheria yanaeleza kuwa inalenga kuweka haki na ustawi wa mtoto; pia inahusu malezi, kuasili, uangalizi na masuala ya ajira ya watoto.", fullTextUrl: "https://oagmis.oag.go.tz/portal/revised-acts/revised/118", fullTextLabel: "Soma Sheria kamili (OAG)", sourceReference: "The Law of the Child Act, Act No. 21 of 2009, Cap. 13; OAG revised publication 25 Apr 2025" },
  { id: "cybercrimes-act", title: "Sheria ya Makosa ya Mtandaoni, Sura ya 443", author: "Ofisi ya Mwanasheria Mkuu", category: "sheria", description: "Cybercrimes Act, 2015 (Na. 14 ya 2015), toleo lililorekebishwa 2025. Inahusu makosa ya mifumo ya kompyuta na TEHAMA pamoja na ushahidi wa kielektroniki.", year: "2015 · Toleo lililorekebishwa 2025", readTime: "Hati rasmi", cover: "from-indigo-950 via-violet-800 to-cyan-950", symbol: "💻", sample: "Maelezo rasmi ya sheria yanataja makosa yanayohusiana na mifumo ya kompyuta na TEHAMA, uchunguzi, ukusanyaji na matumizi ya ushahidi wa kielektroniki.", fullTextUrl: "https://oagmis.oag.go.tz/portal/revised-acts/revised/543", fullTextLabel: "Soma Sheria kamili (OAG)", sourceReference: "The Cybercrimes Act, 2015, Act No. 14 of 2015, Cap. 443; OAG revised publication 25 Apr 2025" },
  { id: "employment-act", title: "Sheria ya Ajira na Mahusiano Kazini", author: "Ofisi ya Mwanasheria Mkuu", category: "sheria", description: "Employment and Labour Relations Act, 2004 (Na. 6 ya 2004), Sura ya 366. Inahusu haki za msingi kazini, viwango vya ajira na utatuzi wa migogoro.", year: "2004 · Toleo lililorekebishwa 2025", readTime: "Hati rasmi", cover: "from-emerald-950 via-teal-800 to-slate-950", symbol: "🧰", sample: "Maelezo rasmi ya sheria yanataja haki za msingi za kazi, viwango vya ajira, majadiliano ya pamoja na mfumo wa kuzuia na kutatua migogoro.", fullTextUrl: "https://oagmis.oag.go.tz/portal/revised-acts/revised/570", fullTextLabel: "Soma Sheria kamili (OAG)", sourceReference: "The Employment and Labour Relations Act, 2004, Act No. 6 of 2004, Cap. 366; OAG revised publication 25 Apr 2025" },
  { id: "education-act", title: "Sheria ya Elimu, Sura ya 353", author: "Ofisi ya Mwanasheria Mkuu", category: "elimu", description: "The Education Act, Sura ya 353. Toleo lililorekebishwa lilichapishwa na Ofisi ya Mwanasheria Mkuu Aprili 2025.", year: "Sura ya 353 · Toleo 2025", readTime: "Hati rasmi", cover: "from-amber-950 via-orange-800 to-slate-950", symbol: "🎓", sample: "Maelezo ya Serikali yanaeleza kuwa Sheria ya Elimu inalenga maendeleo bora ya mfumo wa elimu. Fungua hati rasmi kwa vifungu na masharti kamili.", fullTextUrl: "https://oagmis.oag.go.tz/portal/revised-acts/revised/457", fullTextLabel: "Soma Sheria ya Elimu (OAG)", sourceReference: "The Education Act, Cap. 353; OAG revised publication 25 Apr 2025" },
  { id: "penal-code", title: "Kanuni ya Adhabu, Sura ya 16", author: "Ofisi ya Mwanasheria Mkuu", category: "sheria", description: "Penal Code, Cap. 16. Fungua nakala rasmi ya OAG na uhakiki marekebisho yanayotumika kabla ya kutegemea kifungu chochote.", year: "Sura ya 16 · Toleo rasmi", readTime: "Hati rasmi", cover: "from-red-950 via-stone-900 to-amber-950", symbol: "📕", sample: "Hii ni rejea ya sheria ya jinai. Maelezo ya kadi hayachukui nafasi ya kusoma kifungu husika na marekebisho yake.", fullTextUrl: "https://oagmis.oag.go.tz/portal/acts/revised/121/download", fullTextLabel: "Fungua hati rasmi ya Penal Code", sourceReference: "The Penal Code Act, Cap. 16; OAG official text" },
  { id: "learning-science", title: "Sayansi ya Kujifunza kwa Ufanisi", author: "Mwongozo wa elimu unaotegemea tafiti", category: "elimu", description: "Mwongozo mfupi kuhusu kurudia somo kwa vipindi na kujipima kwa kukumbuka bila kuangalia majibu.", year: "Tafiti za 2022–2026", readTime: "Dakika 8", cover: "from-blue-950 via-cyan-800 to-emerald-950", symbol: "🧠", sample: "Tafiti za elimu zinaonyesha kuwa kurudia kujifunza kwa vipindi na kujitahidi kukumbuka taarifa kunaweza kusaidia kumbukumbu ya muda mrefu. Ufanisi hutegemea somo, muda na namna ya kufanya mazoezi.", fullTextUrl: "https://www.nature.com/articles/s44159-022-00089-1", fullTextLabel: "Soma mapitio ya utafiti", sourceReference: "Carpenter, Pan & Butler, Nature Reviews Psychology (2022)" },
  { id: "sleepy-hollow", title: "Mwendeshaji Farasi Asiye na Kichwa", author: "Washington Irving", category: "kutisha", description: "Simulizi maarufu la kutisha kuhusu kijiji chenye uvumi wa mzimu wa mpanda farasi wa usiku.", year: "1820", readTime: "Dakika 16", cover: "from-slate-950 via-indigo-950 to-purple-950", symbol: "🐎", sample: "Usiku ulipoingia Sleepy Hollow, upepo ulivuma kati ya miti mirefu. Watu walifunga milango mapema, kwa sababu kila mtu alikuwa amesikia kwato barabarani.", fullTextUrl: "https://www.gutenberg.org/ebooks/41", fullTextLabel: "Soma nakala kamili (Kiingereza · Project Gutenberg)" },
  { id: "dracula", title: "Dracula", author: "Bram Stoker", category: "kutisha", description: "Riwaya ya kutisha ya kale kuhusu hesabu za ajabu, kasri la mbali na siri ya kiumbe wa usiku.", year: "1897", readTime: "Dakika 20", cover: "from-violet-950 via-red-950 to-black", symbol: "🦇", sample: "Barua zilifika zikiwa na habari zisizoeleweka. Kila ukurasa uliongeza swali jipya, na kila usiku kasri lilionekana kuwa karibu zaidi.", fullTextUrl: "https://www.gutenberg.org/ebooks/345", fullTextLabel: "Soma nakala kamili (Kiingereza · Project Gutenberg)" },
  { id: "frankenstein", title: "Frankenstein", author: "Mary Shelley", category: "kutisha", description: "Hadithi ya majaribio ya sayansi, wajibu wa muumbaji na matokeo ya kuachwa peke yako.", year: "1818", readTime: "Dakika 19", cover: "from-slate-950 via-blue-950 to-emerald-950", symbol: "⚡", sample: "Katika maabara yenye baridi, tamaa ya kujua ilimfanya Victor kuvuka mpaka ambao hakuelewa gharama yake.", fullTextUrl: "https://www.gutenberg.org/ebooks/84", fullTextLabel: "Soma nakala kamili (Kiingereza · Project Gutenberg)" },
  { id: "sherlock", title: "Siri ya Alama Nne", author: "Arthur Conan Doyle", category: "stori", description: "Upelelezi wa Sherlock Holmes unaochunguza alama za ajabu, ushahidi na siri iliyofichwa kwa miaka.", year: "1890", readTime: "Dakika 17", cover: "from-stone-950 via-amber-900 to-slate-950", symbol: "🔎", sample: "Holmes alitazama alama ndogo kwenye dirisha na kutabasamu. Kile ambacho wengine walikiita uchafu kilikuwa ushahidi muhimu.", fullTextUrl: "https://www.gutenberg.org/ebooks/2097", fullTextLabel: "Soma nakala kamili (Kiingereza · Project Gutenberg)" },
  { id: "odyssey", title: "Safari ya Odysseus", author: "Homer", category: "mashujaa", description: "Safari ya shujaa wa kale anayepambana na majaribu, bahari na vikwazo ili kurejea nyumbani.", year: "Simulizi la kale", readTime: "Dakika 21", cover: "from-blue-950 via-cyan-900 to-amber-950", symbol: "⚓", sample: "Bahari ilionekana kutokuwa na mwisho. Odysseus alijua kuwa nguvu pekee hazingemrudisha nyumbani; alihitaji hekima na subira.", fullTextUrl: "https://www.gutenberg.org/ebooks/1727", fullTextLabel: "Soma nakala kamili (Kiingereza · Project Gutenberg)" },
  { id: "art-of-war", title: "Sanaa ya Vita", author: "Sun Tzu", category: "siasa", description: "Mafundisho ya kale kuhusu mkakati, maandalizi, nidhamu na namna ya kuepusha migogoro isiyo ya lazima.", year: "Karne ya 5 KK", readTime: "Dakika 14", cover: "from-red-950 via-stone-900 to-amber-950", symbol: "⚔️", sample: "Ushindi bora si ule unaopatikana kwa nguvu nyingi, bali ule unaotokana na kuelewa mazingira na kufanya maandalizi.", fullTextUrl: "https://www.gutenberg.org/ebooks/132", fullTextLabel: "Soma nakala kamili (Kiingereza · Project Gutenberg)" },
  { id: "julius-caesar", title: "Julius Caesar: Kupanda na Kuanguka", author: "Historia ya Roma", category: "mashujaa", description: "Maisha ya jenerali na kiongozi wa Roma, mageuzi ya dola na mgogoro wa mamlaka uliobadili historia.", year: "Karne ya 1 KK", readTime: "Dakika 16", cover: "from-red-950 via-orange-900 to-stone-950", symbol: "🛡️", sample: "Roma ilikuwa na nguvu, lakini ndani ya kuta zake kulikuwa na hofu ya nani angeiongoza kesho." },
  { id: "timbuktu", title: "Timbuktu: Hazina ya Wasomi", author: "Historia ya Afrika Magharibi", category: "miji", description: "Mji wa kihistoria wa biashara, miswada, vyuo na wasomi waliounganisha Afrika na ulimwengu.", year: "Karne za kati", readTime: "Dakika 15", cover: "from-amber-950 via-yellow-800 to-orange-950", symbol: "📜", sample: "Katika vyumba vya masomo, kalamu ziliandika maarifa yaliyosafiri kutoka kizazi kimoja hadi kingine." },
  { id: "zanzibar", title: "Zanzibar: Njia za Bahari na Utamaduni", author: "Historia ya Afrika Mashariki", category: "miji", description: "Historia ya Stone Town, biashara ya bahari, lugha, usanifu na mwingiliano wa tamaduni.", year: "Historia ya pwani", readTime: "Dakika 16", cover: "from-teal-950 via-cyan-800 to-amber-950", symbol: "🌴", sample: "Milango ya mbao iliyochongwa ilisimulia historia ya familia, safari za bahari na mji uliokutana na dunia." },
  { id: "don-quixote", title: "Don Quixote", author: "Miguel de Cervantes", category: "stori", description: "Safari ya mbunifu wa ndoto anayechanganya mawazo ya ushujaa na maisha ya kawaida, kwa ucheshi na tafakari.", year: "1605", readTime: "Dakika 18", cover: "from-amber-950 via-stone-700 to-blue-950", symbol: "🐴", sample: "Alijiona kuwa shujaa wa hadithi za kale, ingawa dunia iliyomzunguka ilikuwa imebadilika kabisa.", fullTextUrl: "https://www.gutenberg.org/ebooks/996", fullTextLabel: "Soma nakala kamili (Kiingereza · Project Gutenberg)" },
];

const serials = [
  { id: "mji-wa-siri", title: "Siri ya Mji wa Kale", genre: "Fumbo · Safari · Historia", symbol: "🗝️", cover: "from-amber-950 via-stone-800 to-slate-950", hook: "Mwanafunzi wa historia anagundua ramani iliyofichwa ndani ya nyumba ya babu yake." },
  { id: "barua-usiku", title: "Barua Zinazokuja Usiku", genre: "Mapenzi · Siri · Msisimko", symbol: "💌", cover: "from-rose-950 via-purple-900 to-slate-950", hook: "Barua isiyo na jina inaanza kufika kila usiku, ikiwa na ukweli kuhusu maisha ya Amina." },
  { id: "kivuli-msituni", title: "Kivuli cha Msitu wa Mvua", genre: "Vitisho · Matukio · Afrika", symbol: "🌘", cover: "from-emerald-950 via-green-950 to-black", hook: "Wasafiri watatu wanapotea kwenye njia ya zamani na kugundua kuwa msitu una kumbukumbu." },
];

const dailyLines: Record<string, string[]> = {
  "mji-wa-siri": [
    "Asubuhi ilipofika, Amani alifungua ramani ile tena. Alama ndogo iliyokuwa imefifia sasa ilionekana wazi: duara lililozunguka kisima cha zamani katikati ya mji.",
    "Akiwa na daftari la babu yake, alifuata njia ya mawe hadi kwenye jengo lililotelekezwa. Kwenye ukuta kulikuwa na alama ileile, lakini safari hii ikiwa na tarehe ya kesho.",
    "Mlango ulifunguka kwa sauti ya taratibu. Ndani hakukuwa na hazina, bali picha ya familia yake na ujumbe mmoja: 'Ukweli haupotei, husubiri mtu jasiri.'",
    "Simu yake ilitetemeka. Ujumbe kutoka namba isiyojulikana ulisema: 'Usiende peke yako.' Amani akageuka, na kuona kivuli kikipita mwisho wa korido.",
  ],
  "barua-usiku": [
    "Amina aliikuta bahasha nyingine mlangoni. Ndani yake kulikuwa na picha ya zamani ya kituo cha treni na maneno machache: 'Tulikutana hapa kabla hujazaliwa.'",
    "Alipouliza shangazi yake kuhusu picha ile, mazungumzo yalikoma ghafla. Kwa mara ya kwanza Amina alihisi kuwa familia nzima ilikuwa imekubaliana kuficha jambo fulani.",
    "Usiku huo barua haikuja. Badala yake, simu iliita mara moja tu. Sauti upande wa pili ilinong'ona jina lake na kutaja mahali ambapo picha ilipigwa.",
    "Amina aliamua kwenda kituoni. Kwenye benchi la mwisho alimkuta mtu aliyeshika bahasha ileile, lakini uso wake ulikuwa kama wa mtu aliyekuwa kwenye picha.",
  ],
  "kivuli-msituni": [
    "Mvua ilipoanza, Juma aliona alama za nyayo zikielekea kinyume na upepo. Hakukuwa na mtu mwingine aliyekuwa ameziona, lakini sauti ya filimbi ilisikika tena.",
    "Walipiga kambi karibu na mti mkubwa uliokuwa na michoro ya zamani. Kila mmoja alitambua alama tofauti, kana kwamba msitu ulikuwa unazungumza kwa lugha yao.",
    "Taa ilizimika kwa sekunde chache. Ilipowaka, begi moja lilikuwa limetoweka na kwenye udongo kulikuwa na ujumbe ulioandikwa kwa majani.",
    "Asubuhi waligundua kuwa hawakuwa wamehama mahali walipolala, lakini dira zote zilionyesha upande tofauti. Njia ya kurudi ilikuwa imebadilika.",
  ],
};

const dailyDetails = [
  "kifurushi kidogo kilionekana chini ya jiwe lililopasuka, kikiwa na alama ileile ya kwenye ramani.",
  "mgeni aliuliza swali moja tu, lakini jibu lake lilibadilisha walichodhani kuhusu safari yao.",
  "ukurasa uliokuwa umekunjwa ulifichua jina ambalo halikutajwa kwenye kumbukumbu za familia.",
  "taa tatu ziliwaka mbali kwa mpangilio, kana kwamba mtu alikuwa akituma ujumbe wa siri.",
  "sauti ya hatua ilisikika nyuma yao, kisha ikanyamaza waliposimama kusikiliza.",
  "ufunguo wa shaba ulipatikana ndani ya sanduku ambalo lilikuwa limefungwa kwa miaka mingi.",
  "barua ya zamani ilionyesha kuwa tukio hilo lilishawahi kutokea kwa kizazi kilichopita.",
  "rafiki wa zamani alijitokeza na kuonya kuwa muda wa kufanya uamuzi ulikuwa unakwisha.",
  "alama kwenye ukuta ilibadilika baada ya mwanga wa mwezi kuingia dirishani.",
  "waligundua kuwa mtu aliyekuwa akiwasaidia alikuwa anajua siri nyingi kuliko alivyosema.",
  "ramani ilionyesha njia ya pili iliyokuwa imefichwa chini ya alama ya kwanza.",
  "kitu walichokuwa wakikitafuta kilikuwa karibu zaidi, lakini mtu mwingine alikuwa amekifikia kwanza.",
];
const dailyCliffhangers = [
  "Ghafla, ujumbe mpya ukaonekana: 'Hii ilikuwa jaribio la kwanza tu.'",
  "Kabla hawajazungumza, mlango mwingine ukafungwa kwa kishindo kutoka upande wa pili.",
  "Walipotazama nyuma, alama zote walizokuwa wameacha zilikuwa zimetoweka.",
  "Sauti ileile ikarudi, safari hii ikitamka jina ambalo hawakuwahi kumwambia mtu.",
  "Kwenye ukurasa wa mwisho kulikuwa na tarehe ya kesho na sahihi yao wenyewe.",
  "Safari ilionekana kuisha, lakini kivuli kipya kikajitokeza mwisho wa njia.",
  "Simu ikaita tena. Safari hii sauti ikasema: 'Ninaweza kueleza kila kitu, lakini si hapa.'",
  "Walifungua kifurushi na kukuta picha yao wenyewe, ikiwa imepigwa dakika chache zilizopita.",
  "Mwangaza ulizimika, na waliposikia hatua zikikaribia hawakuwa tena watatu.",
  "Jibu lilikuwa mbele yao muda wote, lakini swali kubwa zaidi lilikuwa nani aliyewaongoza hapo.",
];
const makeDailyChapter = (storyId: string) => {
  const episode = dayNumber() + 1;
  const storyIndex = Math.max(0, serials.findIndex((story) => story.id === storyId));
  const opening = dailyLines[storyId][(episode - 1) % dailyLines[storyId].length];
  const detail = dailyDetails[(episode * 7 + storyIndex * 3) % dailyDetails.length];
  const cliffhanger = dailyCliffhangers[(episode * 11 + storyIndex * 5) % dailyCliffhangers.length];
  return [opening, `Katika sehemu ya ${episode}, ${detail}`, cliffhanger];
};

const dayNumber = () => Math.max(0, Math.floor((new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime() - new Date(2026, 10, 12).getTime()) / 86400000));

type ReaderTheme = "parchment" | "midnight" | "forest" | "rose";
const readerThemes: { id: ReaderTheme; label: string; swatch: string; page: string; ink: string }[] = [
  { id: "parchment", label: "Karatasi ya kale", swatch: "bg-[#ead9b5]", page: "bg-[#f3e7ce] text-[#49351f]", ink: "text-[#49351f]" },
  { id: "midnight", label: "Usiku", swatch: "bg-[#252936]", page: "bg-[#20232d] text-[#e7e0d2]", ink: "text-[#e7e0d2]" },
  { id: "forest", label: "Msitu", swatch: "bg-[#d5e2d2]", page: "bg-[#e4eee1] text-[#263b2d]", ink: "text-[#263b2d]" },
  { id: "rose", label: "Waridi", swatch: "bg-[#f1d9df]", page: "bg-[#f8e9ec] text-[#57333d]", ink: "text-[#57333d]" },
];

const readStored = <T,>(key: string, fallback: T): T => {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
};

export default function BooksPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [selectedSerial, setSelectedSerial] = useState<string | null>(null);
  const [saved, setSaved] = useState<string[]>(() => readStored("tiger-books-saved", []));
  const [theme, setTheme] = useState<ReaderTheme>(() => readStored("tiger-books-theme", "parchment"));
  const [font, setFont] = useState(() => readStored("tiger-books-font", "serif"));
  const [fontSize, setFontSize] = useState(() => readStored("tiger-books-size", 18));
  const [showSettings, setShowSettings] = useState(false);
  const [readIds, setReadIds] = useState<string[]>(() => readStored("tiger-books-read", []));
  const [readingProgress, setReadingProgress] = useState<Record<string, { progress_percent: number; last_chapter: number }>>(() => readStored("tiger-books-progress", {}));
  const [readingPercent, setReadingPercent] = useState(0);
  const [dailyChapters, setDailyChapters] = useState<Record<string, { episode_number: number; title: string; body: string; recap: string }>>({});
  const userId = user?.id;
  const activeTheme = readerThemes.find((item) => item.id === theme) ?? readerThemes[0];
  const filteredBooks = useMemo(() => books.filter((book) => {
    const matchesCategory = category === "all" || book.category === category;
    const haystack = `${book.title} ${book.author} ${book.description} ${categories.find((item) => item.id === book.category)?.label ?? ""}`.toLocaleLowerCase("sw");
    return matchesCategory && haystack.includes(query.trim().toLocaleLowerCase("sw"));
  }), [category, query]);

  useEffect(() => { localStorage.setItem("tiger-books-saved", JSON.stringify(saved)); }, [saved]);
  useEffect(() => { localStorage.setItem("tiger-books-theme", JSON.stringify(theme)); }, [theme]);
  useEffect(() => { localStorage.setItem("tiger-books-font", JSON.stringify(font)); }, [font]);
  useEffect(() => { localStorage.setItem("tiger-books-size", JSON.stringify(fontSize)); }, [fontSize]);
  useEffect(() => { localStorage.setItem("tiger-books-read", JSON.stringify(readIds)); }, [readIds]);
  useEffect(() => { localStorage.setItem("tiger-books-progress", JSON.stringify(readingProgress)); }, [readingProgress]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    const loadProgress = async () => {
      const { data, error } = await supabase.from("books_reading_progress" as any).select("book_id,progress_percent,last_chapter").eq("user_id", userId);
      if (error) { console.warn("Books progress sync unavailable:", error.message); return; }
      if (!active) return;
      const merged: Record<string, { progress_percent: number; last_chapter: number }> = {};
      ((data || []) as unknown as Array<{ book_id: string; progress_percent: number; last_chapter: number }>).forEach((row) => { merged[row.book_id] = { progress_percent: Number(row.progress_percent) || 0, last_chapter: row.last_chapter || 0 }; });
      setReadingProgress((current) => ({ ...current, ...merged }));
    };
    void loadProgress();
    const channel = supabase.channel(`books-progress-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "books_reading_progress", filter: `user_id=eq.${userId}` }, () => void loadProgress())
      .subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [userId]);

  useEffect(() => {
    let active = true;
    const dateKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Dar_es_Salaam" }).format(new Date());
    const loadChapters = async () => {
      const { data, error } = await supabase.from("books_daily_chapters" as any).select("story_id,episode_number,title,body,recap").eq("publish_date", dateKey);
      if (error) { console.warn("Daily AI chapters not available yet:", error.message); return; }
      if (!active) return;
      const next: Record<string, { episode_number: number; title: string; body: string; recap: string }> = {};
      ((data || []) as unknown as Array<{ story_id: string; episode_number: number; title: string; body: string; recap: string }>).forEach((row) => { next[row.story_id] = row; });
      setDailyChapters(next);
    };
    void loadChapters();
    const channel = supabase.channel("books-daily-chapters-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "books_daily_chapters" }, () => void loadChapters())
      .subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const bookId = new URLSearchParams(window.location.search).get("book");
    const match = bookId ? books.find((book) => book.id === bookId) : undefined;
    if (match && selectedBook?.id !== match.id) {
      setSelectedBook(match);
      setReadingPercent(readingProgress[match.id]?.progress_percent ?? 0);
    }
  }, [readingProgress, selectedBook?.id]);

  const saveProgress = async (bookId: string, percent: number, lastChapter = 0) => {
    const row = { progress_percent: Math.max(0, Math.min(100, Math.round(percent))), last_chapter: Math.max(0, lastChapter) };
    setReadingProgress((current) => ({ ...current, [bookId]: row }));
    if (!user) { toast({ title: "Maendeleo yamehifadhiwa kwenye kifaa hiki", description: "Ingia ili uyasawazishe kwenye akaunti yako." }); return; }
    const { error } = await supabase.from("books_reading_progress" as any).upsert({ user_id: user.id, book_id: bookId, ...row, updated_at: new Date().toISOString() }, { onConflict: "user_id,book_id" });
    if (error) { toast({ title: "Usawazishaji haujakamilika", description: "Maendeleo yamebaki kwenye kifaa hiki kwa sasa.", variant: "destructive" }); return; }
    toast({ title: "Maendeleo yamesawazishwa kwenye akaunti yako" });
  };

  const openBook = (book: Book) => { setSelectedBook(book); setSelectedSerial(null); setReadingPercent(readingProgress[book.id]?.progress_percent ?? 0); };
  const openSerial = (id: string) => { setSelectedSerial(id); setSelectedBook(null); setReadingPercent(readingProgress[id]?.progress_percent ?? 0); };

  const toggleSaved = (id: string) => setSaved((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const markRead = (id: string) => setReadIds((current) => current.includes(id) ? current : [...current, id]);
  const activeSerial = serials.find((item) => item.id === selectedSerial);
  useEffect(() => {
    if (selectedBook) setReadingPercent(readingProgress[selectedBook.id]?.progress_percent ?? 0);
    else if (activeSerial) setReadingPercent(readingProgress[activeSerial.id]?.progress_percent ?? 0);
  }, [selectedBook?.id, activeSerial?.id, readingProgress]);
  const today = new Date().toLocaleDateString("sw-TZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <main className="h-full min-h-0 w-full overflow-y-auto overscroll-y-contain bg-background pb-28" style={{ WebkitOverflowScrolling: "touch" }}>
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border/60 bg-background/90 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Library className="h-5 w-5" /></span><div><h1 className="font-bold">Tiger Books</h1><p className="text-[11px] text-muted-foreground">Maktaba yako ya Kiswahili</p></div></div>
        <Button variant="ghost" size="icon" onClick={() => setShowSettings((value) => !value)} aria-label="Mipangilio ya msomaji"><Settings2 className="h-5 w-5" /></Button>
      </header>

      {showSettings && (
        <section className="mx-4 mt-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Muonekano wa msomaji</h2><Button size="icon" variant="ghost" onClick={() => setShowSettings(false)}><X className="h-4 w-4" /></Button></div>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Rangi ya ukurasa</p>
          <div className="flex flex-wrap gap-2">{readerThemes.map((item) => <button key={item.id} onClick={() => setTheme(item.id)} className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs ${theme === item.id ? "border-primary ring-2 ring-primary/20" : "border-border"}`}><span className={`h-4 w-4 rounded-full border border-black/10 ${item.swatch}`} />{item.label}{theme === item.id && <Check className="h-3 w-3 text-primary" />}</button>)}</div>
          <p className="mb-2 mt-4 text-xs font-semibold text-muted-foreground">Aina ya maandishi</p>
          <div className="flex flex-wrap gap-2">{[{ id: "serif", label: "Serif" }, { id: "sans", label: "Rahisi" }, { id: "mono", label: "Mono" }].map((item) => <Button key={item.id} size="sm" variant={font === item.id ? "default" : "outline"} onClick={() => setFont(item.id)}>{item.label}</Button>)}</div>
          <div className="mt-4 flex items-center gap-3"><Type className="h-4 w-4" /><span className="text-xs">Ukubwa wa maandishi</span><div className="flex-1"><Slider min={14} max={28} step={1} value={[fontSize]} onValueChange={(value) => setFontSize(value[0] ?? 18)} /></div><span className="w-8 text-right text-xs tabular-nums">{fontSize}</span></div>
        </section>
      )}

      {!selectedBook && !activeSerial && (
        <div className="space-y-6 p-4">
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-950 via-stone-900 to-slate-950 p-5 text-amber-50 shadow-xl">
            <div className="absolute -right-5 -top-5 text-8xl opacity-20">📜</div>
            <p className="text-[10px] font-bold uppercase tracking-[.25em] text-amber-300">Karibu maktabani</p>
            <h2 className="mt-2 max-w-xs text-2xl font-black leading-tight">Safari ya maarifa inaanzia hapa.</h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-amber-100/80">Gundua mapenzi, historia, mashujaa, miji na simulizi za kusisimua kwa Kiswahili.</p>
            <div className="mt-4 flex items-center gap-2 text-xs text-amber-200"><BookOpen className="h-4 w-4" />{books.length} vitabu na miongozo ya kuanzia</div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between"><div><h2 className="text-lg font-bold">Hadithi ya leo</h2><p className="text-xs text-muted-foreground">{today} · Sehemu ya {dayNumber() + 1}</p></div><span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold text-primary">MPYA LEO</span></div>
            <div className="grid gap-3">{serials.map((story) => <button key={story.id} onClick={() => openSerial(story.id)} className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${story.cover} p-4 text-left text-white shadow-lg transition-transform active:scale-[.99]`}>
              <div className="absolute -right-1 -top-4 text-7xl opacity-20">{story.symbol}</div><div className="relative"><span className="rounded-full bg-white/15 px-2 py-1 text-[9px] font-bold uppercase tracking-wider">Hadithi ya kubuni · Inaendelea</span><h3 className="mt-3 text-lg font-extrabold">{story.title}</h3><p className="mt-1 max-w-[85%] text-xs leading-5 text-white/75">{story.hook}</p><div className="mt-3 flex items-center justify-between"><span className="text-[10px] text-white/70">{story.genre}</span><span className="flex items-center gap-1 text-xs font-bold">Soma sehemu ya leo <ChevronRight className="h-4 w-4" /></span></div></div>
            </button>)}</div>
            <p className="mt-2 text-[10px] leading-4 text-muted-foreground">Sehemu za leo hutengenezwa kwa ratiba ya siku kwenye programu hii. Uzalishaji wa hadithi mpya kwa AI na usambazaji wa seva utahitaji huduma ya backend.</p>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">Tafuta kitabu</h2><span className="text-xs text-muted-foreground">{filteredBooks.length} matokeo</span></div>
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tafuta mada, kitabu au mwandishi..." className="h-12 rounded-xl pl-10 pr-10" />{query && <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><X className="h-4 w-4" /></button>}</div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">Mada za maktaba</h2><Filter className="h-4 w-4 text-muted-foreground" /></div>
            <div className="flex gap-2 overflow-x-auto pb-2">{categories.map((item) => <button key={item.id} onClick={() => setCategory(item.id)} className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${category === item.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"}`}><span>{item.icon}</span>{item.label}</button>)}</div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">{category === "all" ? "Vitabu vinavyopendekezwa" : categories.find((item) => item.id === category)?.label}</h2><span className="text-[10px] text-muted-foreground">Chagua cover kufungua</span></div>
            {filteredBooks.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{filteredBooks.map((book) => <article key={book.id} className="min-w-0"><button onClick={() => openBook(book)} className="w-full text-left"><div className={`relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br ${book.cover} p-3 text-center text-white shadow-lg`}><div className="absolute inset-2 rounded border border-white/20" /><div className="relative flex flex-col items-center"><span className="text-4xl drop-shadow-lg">{book.symbol}</span><span className="mt-3 line-clamp-3 text-sm font-black leading-tight">{book.title}</span><span className="mt-2 text-[8px] uppercase tracking-[.18em] text-white/65">{book.author}</span></div><span className="absolute bottom-3 left-0 right-0 text-[8px] font-bold uppercase tracking-widest text-white/50">TIGER BOOKS</span></div><h3 className="mt-2 line-clamp-2 text-sm font-bold">{book.title}</h3><p className="mt-0.5 truncate text-[10px] text-muted-foreground">{book.author}</p></button><div className="mt-2 flex items-center justify-between"><span className="flex items-center gap-1 text-[10px] text-muted-foreground"><Clock3 className="h-3 w-3" />{book.readTime}</span><button onClick={() => toggleSaved(book.id)} aria-label={saved.includes(book.id) ? "Ondoa kwenye vilivyohifadhiwa" : "Hifadhi kitabu"} className={`rounded-full p-1.5 ${saved.includes(book.id) ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}><Bookmark className="h-4 w-4" fill={saved.includes(book.id) ? "currentColor" : "none"} /></button></div></article>)}</div> : <div className="rounded-2xl border border-dashed border-border p-8 text-center"><Search className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-2 font-semibold">Hakuna kitabu kilichopatikana</p><p className="text-xs text-muted-foreground">Jaribu neno jingine au chagua mada zote.</p><Button className="mt-3" variant="outline" size="sm" onClick={() => { setQuery(""); setCategory("all"); }}>Onyesha vyote</Button></div>}
          </section>

          {saved.length > 0 && <section><h2 className="mb-3 text-lg font-bold">Vilivyohifadhiwa <span className="text-xs text-muted-foreground">({saved.length})</span></h2><div className="flex flex-wrap gap-2">{books.filter((book) => saved.includes(book.id)).map((book) => <button key={book.id} onClick={() => setSelectedBook(book)} className="rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold">{book.symbol} {book.title}</button>)}</div></section>}
          <section className="rounded-2xl border border-border bg-card p-4"><div className="flex items-center gap-2"><Heart className="h-5 w-5 text-rose-500" /><h2 className="font-bold">Mapendekezo ya maktaba</h2></div><ul className="mt-2 space-y-2 text-xs leading-5 text-muted-foreground"><li>• Endelea kusoma ulipoishia na uone historia yako ya usomaji.</li><li>• Pakua vitabu vinavyoruhusiwa ili usome bila intaneti.</li><li>• Shiriki nukuu na mapendekezo na marafiki.</li><li>• Tumia alama za sura na muda wa kusoma kujipangia ratiba.</li></ul></section>
        </div>
      )}

      {selectedBook && (
        <section className="p-4">
          <Button variant="ghost" onClick={() => setSelectedBook(null)} className="mb-3 -ml-2"><ArrowLeft className="mr-2 h-4 w-4" />Rudi maktabani</Button>
          <div className={`relative mx-auto flex aspect-[3/4] max-h-72 max-w-52 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br ${selectedBook.cover} p-5 text-center text-white shadow-2xl`}><div className="absolute inset-3 rounded border border-white/25" /><div className="relative"><span className="text-5xl">{selectedBook.symbol}</span><h2 className="mt-4 text-xl font-black">{selectedBook.title}</h2><p className="mt-2 text-xs text-white/70">{selectedBook.author}</p></div></div>
          <div className="mx-auto mt-5 max-w-2xl"><div className="flex items-start justify-between gap-3"><div><h1 className="text-xl font-black">{selectedBook.title}</h1><p className="mt-1 text-xs text-muted-foreground">{selectedBook.author} · {selectedBook.year}</p></div><Button variant="outline" size="icon" onClick={() => toggleSaved(selectedBook.id)}><Bookmark className="h-4 w-4" fill={saved.includes(selectedBook.id) ? "currentColor" : "none"} /></Button></div>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">{selectedBook.description}</p>
            {selectedBook.fullTextUrl && <a href={selectedBook.fullTextUrl} target="_blank" rel="noreferrer" className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm font-semibold text-primary"><span>{selectedBook.fullTextLabel || "Soma kitabu kamili kutoka chanzo"}</span><ExternalLink className="h-4 w-4 shrink-0" /></a>}
            {selectedBook.sourceReference && <p className="mt-2 text-[10px] leading-4 text-muted-foreground">Rejea: {selectedBook.sourceReference}</p>}
            {selectedBook.fullTextUrl?.includes("gutenberg.org") && <p className="mt-2 text-[10px] leading-4 text-muted-foreground">Toleo la chanzo ni la Kiingereza. Haki za tafsiri na matumizi hutofautiana kwa nchi; hapa tunakuunganisha na chanzo badala ya kunakili kitabu bila ukaguzi wa haki.</p>}
            {selectedBook.category === "sheria" && <p className="mt-2 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-[10px] leading-4 text-muted-foreground">Rejea ya elimu ya sheria, si ushauri wa kisheria. Hati rasmi na marekebisho yake ndiyo ya kuzingatia; baadhi ya sheria hizi zinatumika Tanzania Bara pekee.</p>}
            <div className="mt-4 flex flex-wrap gap-2 text-[10px] text-muted-foreground"><span className="rounded-full bg-muted px-3 py-1">{selectedBook.readTime}</span><span className="rounded-full bg-muted px-3 py-1">{categories.find((item) => item.id === selectedBook.category)?.label}</span>{(readIds.includes(selectedBook.id) || (readingProgress[selectedBook.id]?.progress_percent ?? 0) >= 100) && <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">Umesoma</span>}</div>
            <div className={`mt-5 rounded-2xl p-5 ${activeTheme.page}`}><p className="mb-3 text-[10px] font-bold uppercase tracking-widest opacity-60">Sampuli ya usomaji kwa Kiswahili</p><p style={{ fontSize: `${fontSize}px`, fontFamily: font === "serif" ? "Georgia, serif" : font === "mono" ? "ui-monospace, monospace" : "Arial, sans-serif" }} className="leading-[1.9]">{selectedBook.sample}</p></div>
            {selectedBook.kind === "guide" ? <p className="mt-4 rounded-xl border border-border bg-card p-3 text-xs leading-5 text-muted-foreground">Huu ni mwongozo wa mada, si nakala kamili ya Biblia au Qurani. Fungua tafsiri unayoamini kwa matini kamili; tunaweza kuongeza viungo vya matoleo yaliyoidhinishwa.</p> : <p className="mt-4 rounded-xl border border-border bg-card p-3 text-xs leading-5 text-muted-foreground">Kwa sasa hapa kuna maelezo na sampuli ya Kiswahili. Nakala kamili hufunguliwa kupitia chanzo kilichoonyeshwa juu. Vitabu vilivyo kwenye chanzo cha nje vinaweza kuwa katika lugha ya asili; haki za nakala na tafsiri hukaguliwa kulingana na nchi.</p>}
            <div className="mt-4 rounded-xl border border-border bg-card p-3"><div className="mb-2 flex items-center justify-between text-xs"><span className="font-semibold">Maendeleo ya usomaji</span><span className="font-bold tabular-nums text-primary">{readingPercent}%</span></div><Slider min={0} max={100} step={5} value={[readingPercent]} onValueChange={(value) => setReadingPercent(value[0] ?? 0)} /><Button className="mt-3 w-full" onClick={() => { void saveProgress(selectedBook.id, readingPercent, readingProgress[selectedBook.id]?.last_chapter || 0); if (readingPercent >= 100) markRead(selectedBook.id); }}><Check className="mr-2 h-4 w-4" />Hifadhi maendeleo kwenye akaunti</Button></div>
          </div>
        </section>
      )}

      {activeSerial && (
        <section className="p-4">
          <Button variant="ghost" onClick={() => setSelectedSerial(null)} className="mb-3 -ml-2"><ArrowLeft className="mr-2 h-4 w-4" />Rudi maktabani</Button>
          <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${activeSerial.cover} p-6 text-white shadow-xl`}><span className="text-5xl">{activeSerial.symbol}</span><p className="mt-4 text-[10px] font-bold uppercase tracking-[.2em] text-white/60">Hadithi ya kubuni · Inaendelea</p><h1 className="mt-2 text-2xl font-black">{activeSerial.title}</h1><p className="mt-2 text-sm leading-6 text-white/75">{activeSerial.hook}</p></div>
          <div className={`mt-4 rounded-2xl p-5 ${activeTheme.page}`}><div className="mb-4 flex items-center justify-between gap-2"><div><p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Sehemu ya leo · {today}</p><h2 className="mt-1 text-lg font-black">{dailyChapters[activeSerial.id]?.title || `Sura ya ${dayNumber() + 1}`}</h2></div><CalendarDays className="h-5 w-5 opacity-60" /></div><div className="space-y-4" style={{ fontSize: `${fontSize}px`, fontFamily: font === "serif" ? "Georgia, serif" : font === "mono" ? "ui-monospace, monospace" : "Arial, sans-serif" }}>{(dailyChapters[activeSerial.id]?.body ? dailyChapters[activeSerial.id].body.split(/\n\n+/) : makeDailyChapter(activeSerial.id)).map((paragraph, index, all) => <p key={index} className={index === all.length - 1 ? "border-t border-current/15 pt-4 text-sm font-bold italic" : "leading-[1.9]"}>{paragraph}</p>)}</div></div>
          <div className="mt-4 rounded-xl border border-border bg-card p-3"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold">Maendeleo ya hadithi</p><p className="text-[10px] text-muted-foreground">Sehemu uliyosoma itahifadhiwa kwenye akaunti yako.</p></div><span className="text-xs font-bold text-primary">Sura {readingProgress[activeSerial.id]?.last_chapter || 0}</span></div><Button className="mt-3 w-full" onClick={() => void saveProgress(activeSerial.id, 100, dailyChapters[activeSerial.id]?.episode_number || dayNumber() + 1)}><Check className="mr-2 h-4 w-4" />Hifadhi kuwa nimesoma sura hii</Button></div>
        </section>
      )}
    </main>
  );
}
