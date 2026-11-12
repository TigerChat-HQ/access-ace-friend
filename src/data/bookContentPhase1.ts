export type BookChapter = {
  title: string;
  paragraphs: string[];
  reflection: string;
};

export const BOOK_CONTENT_PHASE_1: Record<string, BookChapter[]> = {
  "romeo-juliet": [
    { title: "Verona na chuki ya familia", paragraphs: [
      "Verona ni mji ambamo familia za Montague na Capulet zimezozana kwa muda mrefu. Ugomvi wao umezoeleka kiasi kwamba hata watu wasiouanzisha hujikuta wakivutwa ndani yake. Shakespeare anaonyesha jinsi chuki ya kurithi inavyoweza kugeuka kuwa desturi: watoto wanakua wakijua upande wao kabla hawajaelewa chanzo cha uhasama.",
      "Romeo mwanzoni anaonekana kijana anayesumbuliwa na mapenzi yasiyomridhisha. Rafiki zake wanajaribu kumtoa katika huzuni hiyo kwa kumshawishi aende kwenye karamu ya Capulet. Huko ndipo anakutana na Juliet. Tukio hili linaweka msingi wa mgongano mkuu: hisia zao binafsi zinapingana na historia ya familia zao."
    ], reflection: "Ni kwa namna gani migogoro ya watu wazima inaweza kurithishwa kwa kizazi kipya?" },
    { title: "Karamu na mapenzi ya ghafla", paragraphs: [
      "Katika karamu, Romeo na Juliet wanavutiana kabla hawajajua kikamilifu majina ya familia zao. Wanapogundua ukweli, furaha yao inachanganyika na hofu. Mazungumzo yao ya dirishani yanaonyesha hamu ya kupima thamani ya mtu kwa tabia na moyo wake, badala ya jina alilopewa.",
      "Ndugu Lawrence anakubali kuwafungisha ndoa kwa matumaini kwamba muungano wao unaweza kupatanisha familia. Hata hivyo, uamuzi huu unafanywa kwa haraka na kwa siri. Siri inapokuwa msingi wa mpango, kila taarifa inayokosekana inaweza kuleta madhara makubwa."
    ], reflection: "Je, nia njema inaweza kuhalalisha uamuzi wa haraka unaofanywa bila kuwashirikisha wahusika wote?" },
    { title: "Hasira, mapambano na kutengana", paragraphs: [
      "Tybalt anatafuta kulipiza kisasi baada ya tukio la karamu. Romeo anajaribu kuepuka mapigano kwa sababu sasa ana uhusiano wa kifamilia na Capulet, lakini Mercutio anaingilia kati na kuuawa. Romeo anapoteza udhibiti na kumuua Tybalt, jambo linalosababisha afukuzwe Verona.",
      "Juliet anakabiliwa na shinikizo la kuolewa na Paris bila kueleza ndoa yake ya siri. Ndugu Lawrence anapendekeza mpango wa dawa itakayomfanya aonekane amekufa kwa muda. Mpango huo unategemea ujumbe kumfikia Romeo kwa wakati, lakini mazingira ya hofu na mawasiliano yasiyoaminika yanaufanya uwe hatari."
    ], reflection: "Ni hatua gani za kupunguza hasira na kuthibitisha taarifa kabla ya kuchukua hatua?" },
    { title: "Msiba na funzo la mwisho", paragraphs: [
      "Ujumbe wa kueleza mpango wa Juliet haumfikii Romeo. Anaposikia kwamba Juliet amekufa, anaamini taarifa hiyo na kurejea Verona. Akiwa kaburini, anakutana na Paris, kisha anakunywa sumu. Juliet anapoamka na kumkuta Romeo amekufa, naye anajiua. Mlolongo huu wa matukio unatokana na chuki ya muda mrefu, haraka na mawasiliano yaliyovunjika.",
      "Familia zinapokutana mbele ya miili ya vijana wao, zinaona gharama halisi ya uhasama. Mwisho huu si kusifu kujiua; ni kuonyesha janga linaloweza kuzaliwa pale jamii inaposhindwa kusikiliza, kusamehe na kutatua migogoro mapema."
    ], reflection: "Ni hatua zipi za maridhiano ambazo familia za Verona zingechukua kabla ya janga?" }
  ],
  "pride-prejudice": [
    { title: "Familia ya Bennet na matarajio ya jamii", paragraphs: [
      "Riwaya inaanza katika jamii ya Kiingereza ambamo ndoa, mali na hadhi vinaathiri usalama wa wanawake. Familia ya Bennet ina binti watano na mali ya familia imefungwa kwa urithi wa kiume. Mama yao anaona ndoa nzuri kama njia ya kuwahakikishia mabinti maisha salama, huku baba yao akitazama mambo kwa kejeli na umbali.",
      "Elizabeth Bennet ni mchangamfu, mwenye akili na anayependa kuchunguza tabia za watu. Jane, dada yake mkubwa, ana huruma na huona mazuri kwa wengine. Tofauti zao zinaonyesha kuwa watu wanaweza kutafsiri tukio moja kwa mitazamo tofauti."
    ], reflection: "Je, matarajio ya kifedha na kijamii yanaathirije uhuru wa kuchagua mwenzi?" },
    { title: "Darcy, Bingley na hukumu za kwanza", paragraphs: [
      "Bingley anawasili jirani akiwa mkarimu na mwenye urafiki, huku rafiki yake Darcy akionekana mwenye kiburi na mwenye kujitenga. Elizabeth anasikia kauli ya Darcy inayomdharau na anajenga taswira hasi kumhusu. Wakati huohuo, Jane na Bingley wanaanza kuvutiana.",
      "Austen anaonyesha jinsi taarifa za kusikia, hadhi na mwonekano wa nje vinavyoweza kuunda hukumu. Darcy naye anahitaji kujifunza kwamba kujiona bora kwa sababu ya cheo kunamfanya ashindwe kuwaelewa wengine."
    ], reflection: "Ni ushahidi gani unaopaswa kutangulia kabla ya kumhukumu mtu?" },
    { title: "Barua inayobadili mtazamo", paragraphs: [
      "Baada ya Darcy kutoa ombi la ndoa lililochanganya mapenzi na dharau ya tofauti za kijamii, Elizabeth anakataa. Darcy anamwandikia barua inayoeleza historia ya Wickham na sababu za kuingilia uhusiano wa Jane na Bingley. Barua hiyo haifuti makosa yake, lakini inampa Elizabeth taarifa mpya za kupima.",
      "Elizabeth anatambua kuwa aliruhusu chuki binafsi na upendeleo kuongoza hitimisho lake. Mabadiliko yake ni muhimu kwa sababu hakubali tu kwamba Darcy alikuwa na hoja; anakubali pia kuchunguza makosa yake mwenyewe."
    ], reflection: "Ni lini mara ya mwisho ulipobadili msimamo baada ya kupata ushahidi mpya?" },
    { title: "Uwajibikaji na upendo uliokomaa", paragraphs: [
      "Matukio ya familia, safari na kashfa inayomhusu Lydia yanaweka wahusika katika majaribu mapya. Darcy anachukua hatua kusaidia kutatua tatizo bila kutafuta sifa, jambo linaloonyesha mabadiliko ya tabia kwa vitendo badala ya maneno pekee.",
      "Elizabeth na Darcy wanapokaribiana tena, uhusiano wao unajengwa juu ya kujitambua, heshima na mazungumzo ya wazi. Riwaya inakosoa kiburi na upendeleo, lakini pia inahoji mfumo wa jamii unaowalazimisha watu kupima thamani ya wenzao kwa mali na cheo."
    ], reflection: "Ni matendo gani yanayoonyesha mabadiliko ya kweli ya tabia kuliko ahadi?" }
  ],
  "hadithi-za-moto": [
    { title: "Mkutano wa moto wa kijijini", paragraphs: [
      "Jioni moja, baada ya mvua kunyesha, wanakijiji wanakusanyika karibu na moto wa pamoja. Kila mtu analeta kuni, chakula au simulizi. Mzee mmoja anasema kuwa moto hauwashi kwa kuni moja tu; unahitaji vipande vingi vinavyosaidiana. Kauli hiyo inakuwa ishara ya umoja wa kijiji.",
      "Mtoto aitwaye Amani anasikia wazee wakizungumzia kisima cha zamani kilichofunikwa baada ya mgogoro wa ardhi. Anajiuliza kwa nini jambo linaloweza kusaidia kila mtu limeachwa bila kutatuliwa."
    ], reflection: "Ni rasilimali gani ya pamoja katika jamii yako inayohitaji ushirikiano ili itumike vizuri?" },
    { title: "Siri ya kisima", paragraphs: [
      "Amani anamwomba bibi yake amweleze historia ya kisima. Bibi anamwambia kuwa zamani kisima kilichimbwa kwa nguvu za familia nyingi, lakini baadaye baadhi ya watu walidai kumiliki ardhi yote iliyokizunguka. Mabishano yalipozidi, watu wakaacha kukitumia.",
      "Badala ya kueneza uvumi, Amani anapendekeza waulize wazee tofauti na kutafuta kumbukumbu za kijiji. Anajifunza kuwa simulizi moja linaweza kuwa na sehemu za kweli na sehemu zilizosahaulika."
    ], reflection: "Kwa nini ni muhimu kusikiliza pande nyingi kabla ya kuamua ukweli wa mgogoro?" },
    { title: "Kikao cha maridhiano", paragraphs: [
      "Kijiji kinaandaa kikao. Wawakilishi wa familia wanazungumza, na kila upande unaeleza hofu yake. Mwalimu anapendekeza ramani ya eneo na kumbukumbu za awali zichunguzwe. Hatua hii inabadilisha mjadala kutoka lawama kwenda kwenye ushahidi.",
      "Wanakijiji wanakubaliana kuwa kisima ni rasilimali ya matumizi ya wote, huku mipaka ya mashamba binafsi ikiheshimiwa. Wanaunda kamati ndogo ya usafi, matengenezo na utatuzi wa migogoro."
    ], reflection: "Ni kanuni zipi zinaweza kufanya makubaliano ya jamii yawe ya haki na ya kudumu?" },
    { title: "Mwanga unaobaki", paragraphs: [
      "Baada ya kisima kufunguliwa, familia zinashirikiana kukisafisha na kuweka ratiba ya matumizi. Si kila mtu anakubaliana na kila jambo, lakini sasa kuna njia ya kuwasilisha malalamiko bila kuanzisha ugomvi.",
      "Usiku unaofuata, Amani anasimulia hadithi karibu na moto. Anasema kuwa siri kubwa haikuwa ndani ya kisima; ilikuwa katika uwezo wa watu kusikilizana. Moto unaendelea kuwaka kwa sababu kila mmoja amejifunza kuchangia."
    ], reflection: "Ni jambo gani dogo unaweza kuanzisha ili kuimarisha ushirikiano katika jamii?" }
  ],
  "republic": [
    { title: "Swali la haki", paragraphs: [
      "Jamhuri ya Plato ni mazungumzo ya kifalsafa yanayochunguza maana ya haki na namna jamii inavyopaswa kuongozwa. Socrates na washiriki wenzake wanajadili kama haki ni kusema ukweli, kulipa kila mtu anachostahili au kutii wenye nguvu. Hakuna jibu rahisi linalokubaliwa bila kupimwa.",
      "Mazungumzo yanaonyesha njia ya falsafa: kuuliza maswali, kufafanua maneno na kuchunguza matokeo ya hoja. Plato anatualika kutofautisha kati ya kile kinachoonekana kuwa haki na kile kinachoweza kutetewa kwa sababu."
    ], reflection: "Je, sheria inaweza kuwa halali lakini isiwe ya haki? Toa mfano na sababu." },
    { title: "Mji na tabia za wananchi", paragraphs: [
      "Washiriki wanapanua swali kutoka kwa mtu mmoja hadi kwenye mji mzima. Wanachunguza kazi tofauti zinazohitajika ili jamii iendelee: uzalishaji, ulinzi, elimu na uongozi. Wazo kuu ni kwamba jamii hutegemeana, lakini mgawanyo wa majukumu unahitaji uangalizi ili usigeuke unyonyaji.",
      "Plato anatumia mfano wa mji kuchunguza nafsi ya mtu. Kama jamii ina sehemu zinazohitaji uratibu, mtu pia ana tamaa, hisia na uwezo wa kufikiri vinavyohitaji uwiano."
    ], reflection: "Ni kwa namna gani mgawanyo wa kazi unaweza kuwa wa manufaa bila kuzuia fursa sawa?" },
    { title: "Elimu na uongozi", paragraphs: [
      "Katika mazungumzo, elimu si kukusanya taarifa pekee; ni kujifunza kutafuta ukweli na kutambua mipaka ya uelewa. Mfano wa pango unaonyesha watu waliokulia wakiona vivuli na kudhani ndivyo uhalisia wote. Kutoka pangoni ni safari ngumu ya kuhoji imani na kuzoea mwanga wa maarifa.",
      "Plato anapendekeza viongozi wafundishwe kwa muda mrefu na kupimwa katika hekima, nidhamu na uwezo wa kuweka manufaa ya umma mbele. Hili ni wazo la kifalsafa la kale, si mpango wa kisiasa unaopaswa kunakiliwa bila kuhoji."
    ], reflection: "Ni sifa zipi za kiongozi zinazoweza kupimwa kwa vitendo?" },
    { title: "Haki, sheria na maisha bora", paragraphs: [
      "Sehemu za mwisho zinachunguza aina za utawala na jinsi tamaa ya mamlaka inavyoweza kuharibu mji. Plato anaonya kuwa jamii inapothamini utajiri, sifa au matamanio kuliko hekima na haki, taasisi zake zinaweza kudhoofika.",
      "Kusoma Jamhuri leo kunahitaji kutambua mazingira yake ya kale na pia kuuliza maswali mapya kuhusu usawa, uhuru na ushiriki wa wananchi. Thamani yake kubwa ni kutufundisha kuchunguza hoja za kisiasa badala ya kuzikubali kwa sababu tu zimetolewa na mtu mwenye mamlaka."
    ], reflection: "Ni vipimo gani vya uwajibikaji vinavyoweza kusaidia kulinda haki katika jamii ya leo?" }
  ]
};
