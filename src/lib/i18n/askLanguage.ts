export type AskLang = 'en' | 'sw';

const SWAHILI_MARKERS = [
  'habari', 'jambo', 'asante', 'mvua', 'maziwa', 'shamba', 'soko', 'bei',
  'mavuno', 'gharama', 'lita', 'gunia', 'ngombe', "ng'ombe", 'nipande',
  'kesho', 'jana', 'leo', 'nini', 'nifanye', 'ramani', 'uzalishaji',
  'ugonjwa', 'wadudu', 'dawa', 'mbolea', 'mbegu', 'karibu', 'wapi',
  'ninaweza', 'nililipa', 'nilivuna', 'alitoa', 'asubuhi', 'jioni',
  'tafadhali', 'sasa', 'mambo', 'niaje', 'salama', 'nashukuru'
];

export function detectAskLanguage(question: string, preferred?: AskLang | null): AskLang {
  const q = question.toLocaleLowerCase();
  const hits = SWAHILI_MARKERS.filter((term) => q.includes(term)).length;
  if (hits >= 2) return 'sw';
  return preferred === 'sw' ? 'sw' : 'en';
}

const PHRASES: Array<[string, string]> = [
  ['Based on your records:', 'Kulingana na kumbukumbu zako:'],
  ['Based on current conditions:', 'Kulingana na hali ya sasa:'],
  ['My suggestion:', 'Pendekezo langu:'],
  ['Based on the forecast for your farm place, not a guess from me:', 'Kulingana na utabiri wa mahali pa shamba, si dhana yangu:'],
  ['Based on the diary you added,', 'Kulingana na shajara uliyoongeza,'],
  ['Based on what you added', 'Kulingana na ulichoongeza'],
  ['Based on the', 'Kulingana na'],
  ['Added by you — not checked during a farm visit.', 'Umeongeza wewe — bado haijakaguliwa wakati wa tembeleo la shamba.'],
  ['Added by you — not checked during a farm visit', 'Umeongeza wewe — bado haijakaguliwa wakati wa tembeleo la shamba'],
  ['I will not invent a fertilizer quote or promise a loan.', 'Sitatengeneza bei ya mbolea wala kuahidi mkopo.'],
  ['I will not invent a price or promise a loan.', 'Sitatengeneza bei wala kuahidi mkopo.'],
  ['I cannot promise a loan or show a score.', 'Siwezi kuahidi mkopo wala kuonyesha alama.'],
  ['I can talk about your Passport, records and next step.', 'Naweza kuzungumza kuhusu Pasipoti yako, kumbukumbu, na hatua inayofuata.'],
  ['Nothing is saved until you confirm.', 'Hakuna kinachohifadhiwa mpaka uthibitishe.'],
  ['I will not change your farm book unless you confirm.', 'Sitabadilisha kumbukumbu za shamba bila wewe kuthibitisha.'],
  ['A forecast can change. Check the field before you act.', 'Utabiri unaweza kubadilika. Angalia shamba kabla ya kutenda.'],
  ['A reported price is not what your buyer or agrovet must charge.', 'Bei iliyoripotiwa si lazima ndiyo mnunuzi au agrovet atakayotoza.'],
  ['These are Ministry reported prices, not a live shop offer.', 'Hizi ni bei za Wizara zilizoripotiwa, si bei hai ya duka.'],
  ['Confirm the final price at the market.', 'Thibitisha bei ya mwisho sokoni.'],
  ['I do not have your transport cost, so I cannot say which option leaves more net income.', 'Sina gharama yako ya usafiri, kwa hiyo siwezi kusema ipi inakuachia faida zaidi.'],
  ['I will not name a pesticide, spray programme, or chemical rate.', 'Sitataja dawa ya kuua wadudu, mpango wa kunyunyizia, wala kiasi cha kemikali.'],
  ['I will not recommend a veterinary medicine or a dose. If an animal is in pain, off feed, or suddenly weak, contact a veterinary officer. I can help you find a listed animal service near the farm if one is saved.', 'Sitapendekeza dawa ya mifugo wala kipimo. Mnyama akiuma, akiacha kula, au akiwa dhaifu ghafla, wasiliana na daktari wa mifugo. Naweza kukusaidia kupata huduma iliyoandikwa karibu na shamba ikiwa ipo.'],
  ['I will not recommend a veterinary medicine or a dose.', 'Sitapendekeza dawa ya mifugo wala kipimo.'],
  ['In Kenya that has to match a current PCPB registered use and the product label. I do not have that register on this phone. A local extension officer or agrovet can read the label with you.', 'Nchini Kenya hiyo inafaa kufuata matumizi yaliyosajiliwa na PCPB na lebo ya bidhaa. Sina rejista hiyo kwenye simu hii. Afisa wa ugani au agrovet anaweza kusoma lebo pamoja nawe.'],
  ['contact a veterinary officer', 'wasiliana na daktari wa mifugo'],
  ['Loan and score rules stay with the institution.', 'Sheria za mkopo na alama zinabaki kwa taasisi.'],
  ['High-risk advice needs a registered label or a veterinary officer.', 'Ushauri hatari unahitaji lebo iliyosajiliwa au daktari wa mifugo.'],
  ['From this phone', 'Kutoka simu hii'],
  ['This uses what is saved on this phone.', 'Hii inatumia kilichohifadhiwa kwenye simu hii.'],
  ['It is not a farm visit, a price promise, or a loan decision.', 'Si tembeleo la shamba, ahadi ya bei, wala uamuzi wa mkopo.'],
  ['Look at the soil on the farm before you plant.', 'Angalia udongo shambani kabla ya kupanda.'],
  ['I will not tell you to plant from a chat answer.', 'Sitakuambia upande kutokana na jibu la gumzo.'],
  ['Satellite or a saved look cannot identify a pest or disease.', 'Setilaiti au muonekano uliohifadhiwa hauwezi kuthibitisha wadudu au ugonjwa.'],
  ['I will not name a definite cause from this alone.', 'Sitataja sababu ya hakika kutokana na hii peke yake.'],
  ['Do not spray from a chat answer.', 'Usinyunyizie kutokana na jibu la gumzo.'],
  ['A question about this farm', 'Swali kuhusu shamba hili'],
  ['How large is this farm? What is nearby?', 'Shamba hili ni kubwa kiasi gani? Nini kiko karibu?'],
  ['Ask about this mapped farm', 'Uliza kuhusu shamba hili lililochorwa'],
  ['Weather, prices or why the profile needs work', 'Hali ya hewa, bei, au kwa nini wasifu unahitaji kazi'],
  ['Will it rain on this farm?', 'Mvua itanyesha katika shamba hili?'],
  ['Where should I sell near this farm?', 'Niuzie wapi karibu na shamba hili?'],
  ['Where can I sell or buy near this farm?', 'Naweza kuuza au kununua wapi karibu na shamba hili?'],
  ['What should I do first?', 'Nifanye nini kwanza?'],
  ['How is my Passport looking?', 'Pasipoti yangu iko vipi?'],
  ['What can I improve?', 'Naweza kuboresha nini?'],
  ['How is the weather for my farm?', 'Hali ya hewa ya shamba langu iko vipi?'],
  ['What is the latest price near me?', 'Bei ya karibu iliyoripotiwa ni ipi?'],
  ['How is my production?', 'Uzalishaji wangu uko vipi?'],
  ['What have I spent?', 'Nimetumia kiasi gani?'],
  ['Where can I sell near my farm?', 'Naweza kuuza wapi karibu na shamba?'],
  ['Where can I buy inputs near my farm?', 'Naweza kununua pembejeo wapi karibu na shamba?'],
  ['Where can I get veterinary help near my farm?', 'Naweza kupata daktari wa mifugo wapi karibu na shamba?'],
  ['Is my farm mapped?', 'Shamba langu limewekwa ramani?'],
  ['Why is my profile incomplete?', 'Kwa nini wasifu wangu haujakamilika?'],
  ['What is still waiting to send?', 'Nini bado kinasubiri kutumwa?'],
  ['Show the next 3 days', 'Onyesha siku 3 zijazo'],
  ['How large is this farm?', 'Shamba hili ni kubwa kiasi gani?'],
  ['What markets are near here?', 'Soko zipi ziko karibu?'],
  ['Which market is closest?', 'Soko ipi iko karibu zaidi?'],
  ['Will it rain tomorrow?', 'Kesho kutanyesha?'],
  ['What fertilizer prices can you see?', 'Bei gani za mbolea unaona?'],
  ['What fertilizer cost have I saved?', 'Gharama gani ya mbolea nimehifadhi?'],
  ['What record is still needed?', 'Rekodi gani bado inahitajika?'],
  ['How do I map my farm?', 'Nawezaje kuweka ramani ya shamba?'],
  ['Save this to your dairy records?', 'Hifadhi hii kwenye kumbukumbu za maziwa?'],
  ['Save this cost?', 'Hifadhi gharama hii?'],
  ['I understood', 'Nimeelewa'],
  ['litres of milk yesterday', 'lita za maziwa jana'],
  ['litres of milk today', 'lita za maziwa leo'],
  ['I can add a harvest of', 'Naweza kuongeza mavuno ya'],
  ['What bag size should I use is still missing, so I will save the bag count only if you confirm.', 'Ukubwa wa gunia bado haujawekwa, kwa hiyo nitahifadhi idadi ya magunia tu ukithibitisha.'],
  ['I understood a farm cost of', 'Nimeelewa gharama ya shamba ya'],
  ['your farm place', 'mahali pa shamba lako'],
  ['your farm', 'shamba lako'],
  ['chance of rain', 'uwezekano wa mvua'],
  ['Rain looks likely', 'Mvua inaonekana karibu'],
  ['Coming days:', 'Siku zijazo:'],
  ['Not saved. Tell me again if you want to add it later.', 'Haijahifadhiwa. Niambie tena ukitaka kuiongeza baadaye.'],
  ['Saved. Added by you — not checked during a farm visit. You can correct it from Activity if I misunderstood.', 'Imehifadhiwa. Umeongeza wewe — bado haijakaguliwa wakati wa tembeleo. Unaweza kurekebisha kwenye Shughuli nikiwa nimeelewa vibaya.'],
  ['I understood the figure, but I cannot save it until you add what you grow or keep.', 'Nimeelewa kiasi, lakini siwezi kuhifadhi mpaka uongeze unacholima au kufuga.'],
  ['I am missing a quantity or amount, so I did not save anything.', 'Kiasi hakipo, kwa hiyo sikuhifadhi chochote.']
];

export function localizeAskText(text: string, language: AskLang) {
  if (language !== 'sw' || !text) return text;
  return PHRASES.reduce((current, [english, swahili]) => current.split(english).join(swahili), text);
}

export function localizeAskList(items: string[], language: AskLang) {
  return items.map((item) => localizeAskText(item, language));
}

export const ASK_UI = {
  en: {
    title: 'Ask Mkulima',
    emptyTitle: 'Ask about this farm',
    emptyBody: 'Talk the way you would to a neighbour. I will use what you saved, then weather, prices or places when those tools have data. I will not invent a price, a spray, or a loan.',
    placeholder: 'Ask about your farm',
    how: 'How I know',
    hideHow: 'Hide how I know',
    fromPhone: 'From this phone',
    saveDraft: 'Save to records',
    notNow: 'Not now',
    retry: 'Try again',
    typing: 'Looking at your farm book…',
    opening: 'Opening…',
    live: 'Live · your farm records',
    phoneSignIn: 'On this phone · sign in for live',
    onPhone: 'On this phone',
    openingBook: 'Opening your farm book…',
    offline: 'On this phone',
    busy: 'The assistant is busy. Wait a moment, then try again.',
    timeout: 'That took too long. Your farm data is still safe.',
    auth: 'Sign in again if you want the live assistant. You can still ask from this phone.',
    fail: 'I could not answer that. Your farm data is still safe. Try again when you have a signal.',
    voiceFail: 'Voice is not available here. Type your question.',
    clear: 'Clear conversation'
  },
  sw: {
    title: 'Uliza Mkulima',
    emptyTitle: 'Uliza kuhusu shamba hili',
    emptyBody: 'Ongea kama unavyoongea na jirani. Natumia ulichohifadhi, kisha hali ya hewa, bei au sehemu zilizoandikwa. Sitatengeneza bei, dawa, wala mkopo.',
    placeholder: 'Uliza kuhusu shamba lako',
    how: 'Ninaajuaje',
    hideHow: 'Ficha jinsi ninavyojua',
    fromPhone: 'Kutoka simu hii',
    saveDraft: 'Hifadhi kwenye kumbukumbu',
    notNow: 'Sio sasa',
    retry: 'Jaribu tena',
    typing: 'Naangalia kumbukumbu za shamba…',
    opening: 'Inafungua…',
    live: 'Moja kwa moja · kumbukumbu za shamba',
    phoneSignIn: 'Simu hii · ingia kwa moja kwa moja',
    onPhone: 'Kutoka simu hii',
    openingBook: 'Inafungua kumbukumbu za shamba…',
    offline: 'Kutoka simu hii',
    busy: 'Msaidizi ana shughuli. Ngoja kidogo, kisha jaribu tena.',
    timeout: 'Imechukua muda mrefu. Data ya shamba bado iko salama.',
    auth: 'Ingia tena ili kupata msaidizi wa moja kwa moja. Bado unaweza kuuliza kutoka simu hii.',
    fail: 'Sikuweza kujibu. Data ya shamba bado iko salama. Jaribu tena ukiwa na mtandao.',
    voiceFail: 'Sauti haipatikani hapa. Andika swali.',
    clear: 'Futa mazungumzo'
  }
} as const;
