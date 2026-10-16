import "./style.css";

type EventDay = {
  id: string;
  date: string;
  label: string;
  venue: string;
  entryTime: string;
  cutoffTime: string;
  officialSlots: OfficialSlot[];
};

type Ticket = {
  id: string;
  eventId: string;
  member: string;
  slot: string;
  start: string;
  end: string;
  qty: number;
  note: string;
  purchaseGroup?: string;
  done?: boolean;
};

type AvailabilityWindow = {
  id: string;
  eventId: string;
  type: "available" | "blocked";
  start: string;
  end: string;
  note: string;
};

type OfficialSlot = {
  name: string;
  category: string;
  entryTime: string;
  cutoffTime: string;
  startTime: string;
  groupOptions?: GroupOption[];
};

type GroupOption = {
  id: string;
  members: string[];
};

type FilterState = {
  eventId: string;
  member: string;
  alert: "all" | "alert" | "clear";
};

type AppState = {
  eventDays: EventDay[];
  tickets: Ticket[];
  windows: AvailabilityWindow[];
  selectedEventId: string;
  activeTab: "overview" | "tickets";
  filter: FilterState;
};

const members = ["西田汐里", "江口紗耶", "前田こころ", "岡村美波", "清野桃々姫", "平井美葉", "小林萌花", "里吉うたの", "小島はな", "大坪茉乃", "杉山結菜", "その他"];
const STORAGE_KEY = "fortune-beyooooonds-timetable-v3";
const OFFICIAL_SOURCE_URL = "https://helloproject.com/event/710ded9c97c27513e9e2b81b98478049c11b4ea3011b4fe45cda5f0c6c366f57/";
let editingTicketId: string | null = null;
let editingDayId: string | null = null;
let editingWindowId: string | null = null;

const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const escapeHtml = (value: string | number) => String(value).replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", "\"": "&quot;"
}[character] ?? character));
const timeToMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};
const minutesToTime = (minutes: number) => {
  const hours = Math.floor(minutes / 60).toString().padStart(2, "0");
  const mins = Math.round(minutes % 60).toString().padStart(2, "0");
  return `${hours}:${mins}`;
};
const formatDate = (date: string) => {
  const parsed = new Date(`${date}T00:00:00`);
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${parsed.getMonth() + 1}/${parsed.getDate()}（${weekdays[parsed.getDay()]}）`;
};
const formatLongDate = (date: string) => {
  const parsed = new Date(`${date}T00:00:00`);
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${parsed.getFullYear()}年${parsed.getMonth() + 1}月${parsed.getDate()}日（${weekdays[parsed.getDay()]}）`;
};
const formatNumber = (value: number) => new Intl.NumberFormat("ja-JP").format(value);

const groups = (...membersByGroup: string[][]): GroupOption[] => membersByGroup.map((members, index) => ({ id: String.fromCharCode(65 + index), members }));
const individualTalkGroups = groups(["西田汐里", "杉山結菜"], ["江口紗耶", "岡村美波", "里吉うたの"], ["前田こころ", "小島はな"], ["平井美葉", "大坪茉乃"], ["清野桃々姫", "小林萌花"]);
const shotGroups = [
  groups(["西田汐里", "前田こころ"], ["江口紗耶", "杉山結菜"], ["岡村美波", "平井美葉"], ["清野桃々姫", "小林萌花", "小島はな"], ["里吉うたの", "大坪茉乃"]),
  groups(["西田汐里", "里吉うたの"], ["江口紗耶", "平井美葉", "小島はな"], ["前田こころ", "岡村美波"], ["清野桃々姫", "大坪茉乃"], ["小林萌花", "杉山結菜"]),
  groups(["西田汐里", "平井美葉"], ["江口紗耶", "清野桃々姫"], ["前田こころ", "小林萌花", "大坪茉乃"], ["岡村美波", "杉山結菜"], ["里吉うたの", "小島はな"]),
  groups(["西田汐里", "岡村美波"], ["江口紗耶", "里吉うたの"], ["前田こころ", "平井美葉"], ["清野桃々姫", "小林萌花"], ["小島はな", "大坪茉乃", "杉山結菜"]),
  groups(["西田汐里", "清野桃々姫", "小林萌花"], ["江口紗耶", "杉山結菜"], ["前田こころ", "小島はな"], ["岡村美波", "大坪茉乃"], ["平井美葉", "里吉うたの"])
];
const groupTalkGroups = [
  groups(["西田汐里", "前田こころ"], ["江口紗耶", "杉山結菜"], ["岡村美波", "平井美葉"], ["清野桃々姫", "小林萌花", "小島はな"], ["里吉うたの", "大坪茉乃"]),
  groups(["西田汐里", "平井美葉"], ["江口紗耶", "小林萌花"], ["前田こころ", "里吉うたの"], ["岡村美波", "清野桃々姫"], ["小島はな", "大坪茉乃", "杉山結菜"]),
  groups(["西田汐里", "小林萌花"], ["江口紗耶", "平井美葉", "杉山結菜"], ["前田こころ", "大坪茉乃"], ["岡村美波", "里吉うたの"], ["清野桃々姫", "小島はな"]),
  groups(["西田汐里", "江口紗耶", "大坪茉乃"], ["前田こころ", "清野桃々姫"], ["岡村美波", "小林萌花"], ["平井美葉", "小島はな"], ["里吉うたの", "杉山結菜"]),
  groups(["西田汐里", "杉山結菜"], ["江口紗耶", "小島はな"], ["前田こころ", "岡村美波", "里吉うたの"], ["清野桃々姫", "平井美葉"], ["小林萌花", "大坪茉乃"])
];
const baseOfficialSlots = (osaka = false): OfficialSlot[] => osaka ? [
  { name: "第①部 3ショット・4ショットチェキ会", category: "3/4ショットチェキ", entryTime: "11:50", cutoffTime: "12:05", startTime: "12:00" },
  { name: "第①部 2ショットチェキ会", category: "2ショットチェキ", entryTime: "12:35", cutoffTime: "12:45", startTime: "12:40" },
  { name: "第②部 2ショットチェキ会", category: "2ショットチェキ", entryTime: "12:50", cutoffTime: "13:05", startTime: "13:00" },
  { name: "第①部 個別お話し会", category: "個別お話し会", entryTime: "14:05", cutoffTime: "14:15", startTime: "14:10" },
  { name: "第②部 個別お話し会", category: "個別お話し会", entryTime: "14:20", cutoffTime: "14:45", startTime: "14:40" },
  { name: "第③部 個別お話し会", category: "個別お話し会", entryTime: "15:15", cutoffTime: "15:25", startTime: "15:20" },
  { name: "第④部 個別お話し会", category: "個別お話し会", entryTime: "15:30", cutoffTime: "15:55", startTime: "15:50" },
  { name: "第①部 グループお話し会", category: "グループお話し会", entryTime: "16:30", cutoffTime: "16:40", startTime: "16:35" },
  { name: "第⑤部 個別お話し会", category: "個別お話し会", entryTime: "17:05", cutoffTime: "17:15", startTime: "17:10" },
  { name: "第⑥部 個別お話し会", category: "個別お話し会", entryTime: "17:20", cutoffTime: "17:45", startTime: "17:40" },
  { name: "第①部 個別サイン会", category: "個別サイン会", entryTime: "18:40", cutoffTime: "18:55", startTime: "18:50" },
  { name: "第①部 個別お絵描き会", category: "個別お絵描き会", entryTime: "19:20", cutoffTime: "19:35", startTime: "19:30" }
] : [
  { name: "第①部 3ショット・4ショットチェキ会", category: "3/4ショットチェキ", entryTime: "10:50", cutoffTime: "11:05", startTime: "11:00" },
  { name: "第①部 2ショットチェキ会", category: "2ショットチェキ", entryTime: "11:35", cutoffTime: "11:45", startTime: "11:40" },
  { name: "第②部 2ショットチェキ会", category: "2ショットチェキ", entryTime: "11:50", cutoffTime: "12:05", startTime: "12:00" },
  { name: "第①部 個別お話し会", category: "個別お話し会", entryTime: "13:05", cutoffTime: "13:15", startTime: "13:10" },
  { name: "第②部 個別お話し会", category: "個別お話し会", entryTime: "13:20", cutoffTime: "13:45", startTime: "13:40" },
  { name: "第③部 個別お話し会", category: "個別お話し会", entryTime: "14:15", cutoffTime: "14:25", startTime: "14:20" },
  { name: "第④部 個別お話し会", category: "個別お話し会", entryTime: "14:30", cutoffTime: "14:55", startTime: "14:50" },
  { name: "第①部 グループお話し会", category: "グループお話し会", entryTime: "15:30", cutoffTime: "15:40", startTime: "15:35" },
  { name: "第⑤部 個別お話し会", category: "個別お話し会", entryTime: "16:05", cutoffTime: "16:15", startTime: "16:10" },
  { name: "第⑥部 個別お話し会", category: "個別お話し会", entryTime: "16:20", cutoffTime: "16:45", startTime: "16:40" },
  { name: "第①部 個別サイン会", category: "個別サイン会", entryTime: "17:40", cutoffTime: "17:55", startTime: "17:50" },
  { name: "第①部 個別お絵描き会", category: "個別お絵描き会", entryTime: "18:20", cutoffTime: "18:35", startTime: "18:30" }
];
const addGroupsToSlots = (slots: OfficialSlot[], shot: GroupOption[], talk: GroupOption[]) => slots.map((slot) => ({ ...slot, groupOptions: slot.category === "3/4ショットチェキ" ? shot : slot.category === "グループお話し会" ? talk : slot.category === "個別お話し会" ? individualTalkGroups : undefined }));
const makeEventDay = (id: string, date: string, label: string, venue: string, slots: OfficialSlot[], shotGroupSet: GroupOption[], talkGroupSet: GroupOption[]): EventDay => { const officialSlots = addGroupsToSlots(slots, shotGroupSet, talkGroupSet); return { id, date, label, venue, entryTime: officialSlots[0].entryTime, cutoffTime: officialSlots[officialSlots.length - 1].cutoffTime, officialSlots }; };

const seedState: AppState = {
  eventDays: [
    makeEventDay("event-1", "2026-11-28", "7thシングル発売記念イベント 東京会場①", "ベルサール飯田橋ファースト", baseOfficialSlots(), shotGroups[0], groupTalkGroups[0]),
    makeEventDay("event-2", "2026-11-29", "7thシングル発売記念イベント 東京会場②", "ベルサール飯田橋ファースト", baseOfficialSlots(), shotGroups[1], groupTalkGroups[1]),
    makeEventDay("event-3", "2026-12-06", "7thシングル発売記念イベント 大阪会場①", "インテックス大阪 4号館", baseOfficialSlots(true), shotGroups[2], groupTalkGroups[2]),
    makeEventDay("event-4", "2026-12-12", "7thシングル発売記念イベント 東京会場③", "ベルサール汐留B1F", baseOfficialSlots(), shotGroups[3], groupTalkGroups[3]),
    makeEventDay("event-5", "2027-02-06", "7thシングル発売記念イベント 東京会場④", "ベルサール飯田橋ファースト", baseOfficialSlots(), shotGroups[4], groupTalkGroups[4])
  ],
  tickets: [
    { id: "ticket-1", eventId: "event-1", member: "西田汐里", slot: "第①部 個別お話し会", start: "13:05", end: "13:15", qty: 2, note: "公式の入場受付時間" },
    { id: "ticket-2", eventId: "event-1", member: "前田こころ", slot: "第②部 個別お話し会", start: "13:20", end: "13:45", qty: 1, note: "" },
    { id: "ticket-3", eventId: "event-1", member: "江口紗耶", slot: "第④部 個別お話し会", start: "14:30", end: "14:55", qty: 1, note: "" },
    { id: "ticket-4", eventId: "event-2", member: "小林萌花", slot: "第①部 2ショットチェキ会", start: "11:35", end: "11:45", qty: 1, note: "ポーズ記入用紙を準備" },
    { id: "ticket-5", eventId: "event-3", member: "里吉うたの", slot: "第①部 個別サイン会", start: "18:40", end: "18:55", qty: 2, note: "" },
    { id: "ticket-6", eventId: "event-4", member: "清野桃々姫", slot: "第①部 個別お絵描き会", start: "18:20", end: "18:35", qty: 1, note: "" }
  ],
  windows: [
    { id: "window-1", eventId: "event-1", type: "available", start: "10:50", end: "18:35", note: "公式スケジュール（仮）" },
    { id: "window-2", eventId: "event-2", type: "available", start: "10:50", end: "18:35", note: "公式スケジュール（仮）" },
    { id: "window-3", eventId: "event-3", type: "available", start: "11:50", end: "19:35", note: "公式スケジュール（仮）" },
    { id: "window-4", eventId: "event-4", type: "available", start: "10:50", end: "18:35", note: "公式スケジュール（仮）" },
    { id: "window-5", eventId: "event-5", type: "available", start: "10:50", end: "18:35", note: "公式スケジュール（仮）" }
  ],
  selectedEventId: "event-1",
  activeTab: "overview",
  filter: { eventId: "all", member: "all", alert: "all" }
};

const cloneSeed = (): AppState => JSON.parse(JSON.stringify(seedState)) as AppState;
const loadState = (): AppState => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return cloneSeed();
    const parsed = JSON.parse(stored) as Partial<AppState>;
    if (!Array.isArray(parsed.eventDays) || !Array.isArray(parsed.tickets)) return cloneSeed();
    return {
      eventDays: parsed.eventDays,
      tickets: parsed.tickets,
      windows: Array.isArray(parsed.windows) ? parsed.windows : [],
      selectedEventId: parsed.selectedEventId ?? parsed.eventDays[0]?.id ?? "",
      activeTab: parsed.activeTab === "tickets" ? "tickets" : "overview",
      filter: { eventId: parsed.filter?.eventId ?? "all", member: parsed.filter?.member ?? "all", alert: parsed.filter?.alert ?? "all" }
    };
  } catch {
    return cloneSeed();
  }
};

let state = loadState();

const persist = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
const selectedDay = () => state.eventDays.find((eventDay) => eventDay.id === state.selectedEventId) ?? state.eventDays[0];
const dayTickets = (eventId: string) => state.tickets.filter((ticket) => ticket.eventId === eventId);
const dayWindows = (eventId: string) => state.windows.filter((window) => window.eventId === eventId);

const getTicketAlerts = (ticket: Ticket): string[] => {
  const event = state.eventDays.find((eventDay) => eventDay.id === ticket.eventId);
  if (!event) return ["日程未設定"];
  const alerts: string[] = [];
  if (ticket.member === "未確定") alerts.push("メンバー未確定");
  if (timeToMinutes(ticket.start) < timeToMinutes(event.entryTime)) alerts.push("入場前");
  if (timeToMinutes(ticket.end) > timeToMinutes(event.cutoffTime)) alerts.push("締切後");
  const overlaps = dayTickets(ticket.eventId).some((other) => other.id !== ticket.id && timeToMinutes(ticket.start) < timeToMinutes(other.end) && timeToMinutes(ticket.end) > timeToMinutes(other.start));
  if (overlaps) alerts.push("時間重複");
  const blocked = dayWindows(ticket.eventId).filter((window) => window.type === "blocked").some((window) => timeToMinutes(ticket.start) < timeToMinutes(window.end) && timeToMinutes(ticket.end) > timeToMinutes(window.start));
  if (blocked) alerts.push("参加不可時間");
  const availableWindows = dayWindows(ticket.eventId).filter((window) => window.type === "available");
  if (availableWindows.length > 0 && !availableWindows.some((window) => timeToMinutes(ticket.start) >= timeToMinutes(window.start) && timeToMinutes(ticket.end) <= timeToMinutes(window.end))) alerts.push("参加可能時間外");
  if (timeToMinutes(event.cutoffTime) - timeToMinutes(ticket.end) < 30) alerts.push("締切まで余裕なし");
  return [...new Set(alerts)];
};

const getDayAlerts = (eventId: string) => dayTickets(eventId).filter((ticket) => getTicketAlerts(ticket).length > 0).length;
const getTotalTickets = () => state.tickets.reduce((sum, ticket) => sum + Number(ticket.qty || 0), 0);
const getTotalAlertCount = () => state.tickets.reduce((sum, ticket) => sum + (getTicketAlerts(ticket).length > 0 ? 1 : 0), 0);
const memberClass = (member: string) => `member-${Math.abs([...member].reduce((sum, character) => sum + character.charCodeAt(0), 0)) % 6}`;
const memberColors: Record<string, { background: string; foreground: string }> = {
  "西田汐里": { background: "#f21879", foreground: "#ffffff" },
  "江口紗耶": { background: "#f2d34f", foreground: "#332b00" },
  "大坪茉乃": { background: "#9bd15b", foreground: "#17310e" },
  "杉山結菜": { background: "#d63f4d", foreground: "#ffffff" },
  "前田こころ": { background: "#4aa6c2", foreground: "#ffffff" },
  "岡村美波": { background: "#f28ab4", foreground: "#4a1730" },
  "清野桃々姫": { background: "#f28b2e", foreground: "#ffffff" },
  "小島はな": { background: "#ffffff", foreground: "#252b28" },
  "平井美葉": { background: "#8e5aa8", foreground: "#ffffff" },
  "小林萌花": { background: "#3c9560", foreground: "#ffffff" },
  "里吉うたの": { background: "#3f78c4", foreground: "#ffffff" },
};
const renderMemberLabel = (member: string) => {
  const [group, names] = member.includes("｜") ? member.split("｜", 2) : ["", member];
  const nameMarkup = names.split("・").map((name) => {
    const color = memberColors[name] ?? { background: "#e7ece8", foreground: "#28403a" };
    return `<span class="member-name" style="--member-color:${color.background};--member-ink:${color.foreground}">${escapeHtml(name)}</span>`;
  }).join(`<span class="member-separator">・</span>`);
  return `${group ? `<span class="member-group">${escapeHtml(group)}</span>` : ""}<span class="member-names">${nameMarkup}</span>`;
};
const renderTicketMemberLabel = (ticket: Ticket) => ticket.member === "未確定" && ticket.purchaseGroup ? `${renderMemberLabel(ticket.purchaseGroup)}<span class="member-unconfirmed">メンバー未確定</span>` : renderMemberLabel(ticket.member);

const renderDayOptions = (selectedId: string) => state.eventDays.length === 0 ? "<option value=\"\">日程を先に追加</option>" : state.eventDays.map((eventDay) => `<option value="${escapeHtml(eventDay.id)}" ${eventDay.id === selectedId ? "selected" : ""}>${escapeHtml(formatDate(eventDay.date))} ・ ${escapeHtml(eventDay.label)}</option>`).join("");
const renderCompactDayOptions = (selectedId: string) => state.eventDays.map((eventDay) => `<option value="${escapeHtml(eventDay.id)}" ${eventDay.id === selectedId ? "selected" : ""}>${escapeHtml(formatDate(eventDay.date))} ・ ${escapeHtml(eventDay.venue)}</option>`).join("");
const renderTicketEventChoices = (selectedId: string) => state.eventDays.length === 0 ? `<div class="empty-state small"><span>先に開催日を登録してください。</span></div>` : `<fieldset class="ticket-event-choices"><legend>参加日程</legend><div class="event-choice-grid">${state.eventDays.slice().sort((a, b) => a.date.localeCompare(b.date)).map((eventDay) => `<label class="event-choice ${eventDay.id === selectedId ? "selected" : ""}"><input type="radio" name="eventId" value="${escapeHtml(eventDay.id)}" ${eventDay.id === selectedId ? "checked" : ""} required /><span class="event-choice-date">${escapeHtml(formatDate(eventDay.date))}</span><strong>${escapeHtml(eventDay.label.replace("7thシングル発売記念イベント ", ""))}</strong><small>${escapeHtml(eventDay.venue)}　${escapeHtml(eventDay.entryTime)}〜${escapeHtml(eventDay.cutoffTime)}</small></label>`).join("")}</div></fieldset>`;
const renderMemberOptions = (selectedMember: string) => members.map((member) => `<option value="${escapeHtml(member)}" ${member === selectedMember ? "selected" : ""}>${escapeHtml(member)}</option>`).join("");
const officialSlotsFor = (eventId: string) => state.eventDays.find((eventDay) => eventDay.id === eventId)?.officialSlots ?? [];
const selectedOfficialSlot = (eventId: string, slotName?: string) => officialSlotsFor(eventId).find((slot) => slot.name === slotName) ?? officialSlotsFor(eventId)[0];
const renderTicketSlotField = (eventId: string, selectedSlot?: string) => {
  const slots = officialSlotsFor(eventId);
  if (!slots.length) return `<label class="field full"><span>イベント内容 / 部</span><input id="ticket-slot-input" name="slot" placeholder="例：第①部 個別お話し会" required /></label>`;
  return `<label class="field full"><span>イベント内容 / 部 <small>公式スケジュールから選択</small></span><select id="ticket-slot-select" name="slot" required>${slots.map((slot) => `<option value="${escapeHtml(slot.name)}" ${slot.name === (selectedSlot ?? slots[0].name) ? "selected" : ""}>${escapeHtml(slot.name)}　｜　受付 ${escapeHtml(slot.entryTime)}〜${escapeHtml(slot.cutoffTime)}</option>`).join("")}</select></label>`;
};
const renderTicketMemberField = (eventId: string, slotName?: string, selectedMember?: string, selectedPurchaseGroup?: string) => {
  const slot = selectedOfficialSlot(eventId, slotName);
  if (slot?.groupOptions?.length) {
    if (slot.category === "個別お話し会") {
      const groupValues = slot.groupOptions.map((group) => ({ group, value: `グループ${group.id}｜${group.members.join("・")}` }));
      const activeGroup = groupValues.find((item) => item.value === selectedPurchaseGroup)?.group ?? groupValues[0].group;
      return `<label class="field full"><span>購入グループ <small>券を購入した組み合わせ</small></span><select name="purchaseGroup" required>${groupValues.map(({ value }) => `<option value="${escapeHtml(value)}" ${value === (selectedPurchaseGroup ?? groupValues[0].value) ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select></label><label class="field full"><span>行くメンバー <small>券面で判明したら選択</small></span><select name="member" required><option value="未確定" ${(!selectedMember || selectedMember === "未確定") ? "selected" : ""}>まだ未確定</option>${activeGroup.members.map((member) => `<option value="${escapeHtml(member)}" ${member === selectedMember ? "selected" : ""}>${escapeHtml(member)}</option>`).join("")}</select></label>`;
    }
    const label = "参加グループ（メンバー）";
    return `<label class="field full"><span>${label} <small>公式の組み合わせ</small></span><select name="member" required>${slot.groupOptions.map((group) => { const value = `グループ${group.id}｜${group.members.join("・")}`; return `<option value="${escapeHtml(value)}" ${value === selectedMember ? "selected" : ""}>${escapeHtml(value)}</option>`; }).join("")}</select></label>`;
  }
  return `<label class="field full"><span>メンバー</span><select name="member" required>${renderMemberOptions(selectedMember ?? "")}</select></label>`;
};
const renderBadge = (label: string, kind = "neutral") => `<span class="badge badge-${kind}">${escapeHtml(label)}</span>`;

const renderTimeline = (event: EventDay) => {
  const tickets = dayTickets(event.id).filter((ticket) => {
    const matchesMember = state.filter.member === "all" || ticket.member === state.filter.member;
    const matchesAlert = state.filter.alert === "all" || (state.filter.alert === "alert" ? getTicketAlerts(ticket).length > 0 : getTicketAlerts(ticket).length === 0);
    return matchesMember && matchesAlert;
  }).sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  const nextTicketId = tickets.find((ticket) => !ticket.done)?.id;
  const start = timeToMinutes(event.entryTime);
  const end = timeToMinutes(event.cutoffTime);
  const total = end - start;
  const windows = dayWindows(event.id);

  const availabilityStrip = windows.length === 0 ? `<div class="empty-strip">参加可能時間を設定すると、ここに帯で表示されます。</div>` : windows.map((window) => {
    const left = Math.max(0, ((timeToMinutes(window.start) - start) / total) * 100);
    const width = Math.max(1, Math.min(100 - left, ((timeToMinutes(window.end) - timeToMinutes(window.start)) / total) * 100));
    return `<div class="availability-segment ${window.type}" style="left:${left}%;width:${width}%" title="${escapeHtml(window.note || (window.type === "available" ? "参加可能" : "参加不可"))}"><span>${escapeHtml(window.start)}–${escapeHtml(window.end)}</span></div>`;
  }).join("");

  const rows = tickets.length === 0 ? `<div class="empty-state compact"><strong>表示するチケットがありません</strong><span>フィルターを変えるか、チケットを追加してください。</span></div>` : tickets.map((ticket) => {
    const alerts = getTicketAlerts(ticket);
    const left = Math.max(0, ((timeToMinutes(ticket.start) - start) / total) * 100);
    const width = Math.max(4, Math.min(100 - left, ((timeToMinutes(ticket.end) - timeToMinutes(ticket.start)) / total) * 100));
    return `<article class="timeline-ticket ${alerts.length ? "is-alert" : ""} ${ticket.done ? "is-done" : ""} ${ticket.id === nextTicketId ? "is-next" : ""}">
      <div class="ticket-time"><strong>${escapeHtml(ticket.start)}</strong><span>${escapeHtml(ticket.end)}</span></div>
      <div class="ticket-line"><span class="timeline-dot ${memberClass(ticket.member)}"></span><span class="timeline-connector"></span></div>
      <div class="ticket-content">
        <div class="ticket-heading"><div class="ticket-title-stack"><div class="slot-row">${ticket.done ? `<span class="done-mark" aria-label="完了">✓</span>` : ""}<span class="slot-label">${escapeHtml(ticket.slot)}</span></div><strong class="ticket-member">${renderTicketMemberLabel(ticket)}</strong></div><span class="ticket-quantity">×${escapeHtml(ticket.qty)}</span></div>
        <div class="ticket-meta">${ticket.note ? escapeHtml(ticket.note) : "メモなし"}</div>
        ${alerts.length ? `<div class="alert-list">${alerts.map((alert) => renderBadge(alert, "alert")).join("")}</div>` : `<div class="clear-label"><span class="checkmark">✓</span> いまのところ問題なし</div>`}
      </div>
      <div class="ticket-actions"><button class="icon-button done-button ${ticket.done ? "active" : ""}" data-action="toggle-ticket-done" data-id="${escapeHtml(ticket.id)}" aria-label="予定を${ticket.done ? "未完了に戻す" : "済みにする"}">${ticket.done ? "未完了に戻す" : "済にする"}</button><button class="icon-button" data-action="edit-ticket" data-id="${escapeHtml(ticket.id)}" aria-label="チケットを編集">編集</button><button class="icon-button danger" data-action="delete-ticket" data-id="${escapeHtml(ticket.id)}" aria-label="チケットを削除">削除</button></div>
      <div class="ticket-ruler" style="left:${left}%;width:${width}%"><span>${escapeHtml(ticket.slot)}</span></div>
    </article>`;
  }).join("");

  return `<section class="timeline-panel panel">
    <div class="panel-heading timeline-heading"><div><p class="section-kicker">DAY PLAN</p><h2>今日の動き</h2></div><div class="timeline-legend"><span><i class="legend-dot available"></i>参加可能</span><span><i class="legend-dot blocked"></i>参加不可</span></div></div>
    <div class="availability-chart"><div class="chart-label">参加時間</div><div class="chart-track">${availabilityStrip}</div></div>
    <div class="time-axis"><span>${escapeHtml(event.entryTime)}</span><span>${escapeHtml(minutesToTime(start + total / 2))}</span><span>${escapeHtml(event.cutoffTime)}</span></div>
    <div class="timeline-list">${rows}</div>
  </section>`;
};

const renderOfficialSchedule = (event: EventDay) => {
  const slots = event.officialSlots ?? [];
  return `<section class="official-schedule panel"><div class="panel-heading official-heading"><div><p class="section-kicker">SELECTED DATE / OFFICIAL SCHEDULE</p><h3>${escapeHtml(formatLongDate(event.date))} の公式スケジュール</h3><p class="muted">開場・入場締切・イベント開始と、選択できるグループをまとめて確認できます。</p></div><a class="source-link" href="${OFFICIAL_SOURCE_URL}" target="_blank" rel="noreferrer">公式ページ ↗</a></div>${slots.length ? `<div class="official-table"><div class="official-table-head"><span>内容 / グループ</span><span>開場</span><span>入場締切</span><span>開始</span></div>${slots.map((slot) => `<div class="official-row"><div><strong>${escapeHtml(slot.name)}</strong><small>${escapeHtml(slot.category)}</small>${slot.groupOptions?.length ? `<div class="official-groups">${slot.groupOptions.map((group) => `<span><b>${escapeHtml(group.id)}</b>${escapeHtml(group.members.join("・"))}</span>`).join("")}</div>` : ""}</div><span>${escapeHtml(slot.entryTime)}</span><span>${escapeHtml(slot.cutoffTime)}</span><span class="start-time">${escapeHtml(slot.startTime)}</span></div>`).join("")}</div>` : `<div class="empty-state small"><span>公式の部スケジュールは、日程追加時に入力できます。</span></div>`}</section>`;
};

const renderDayCards = () => state.eventDays.slice().sort((a, b) => a.date.localeCompare(b.date)).map((eventDay) => {
  const total = dayTickets(eventDay.id).reduce((sum, ticket) => sum + ticket.qty, 0);
  const alerts = getDayAlerts(eventDay.id);
  const isSelected = eventDay.id === state.selectedEventId;
  return `<button class="day-card ${isSelected ? "selected" : ""}" data-action="select-day" data-id="${escapeHtml(eventDay.id)}"><div class="day-card-top"><span>${escapeHtml(formatDate(eventDay.date))}</span>${alerts ? renderBadge(`${alerts}件注意`, "alert") : renderBadge("整頓済み", "success")}</div><strong>${escapeHtml(eventDay.label)}</strong><span class="day-card-meta">${escapeHtml(eventDay.entryTime)}〜${escapeHtml(eventDay.cutoffTime)} ・ ${formatNumber(total)}枚</span></button>`;
}).join("");

const renderScheduleSwitcher = (event?: EventDay) => `<section class="schedule-switcher"><div class="schedule-switcher-head"><div><p class="section-kicker">SCHEDULE SELECTOR</p><h2>日程を選ぶ</h2><p class="muted">日付を選ぶと、その日の公式スケジュール全体がここに表示されます。</p></div><button class="button subtle" data-action="open-day">開催日を登録</button></div><div class="day-card-list">${state.eventDays.length ? renderDayCards() : `<div class="empty-state panel"><strong>登録済みのスケジュールはありません</strong><span>公式イベントの日程を登録すると、ここに切り替えボタンが表示されます。</span></div>`}</div>${event ? renderOfficialSchedule(event) : ""}</section>`;

const renderOverview = (event: EventDay) => {
  const tickets = dayTickets(event.id);
  const total = tickets.reduce((sum, ticket) => sum + ticket.qty, 0);
  const alerts = getDayAlerts(event.id);
  const available = dayWindows(event.id).filter((window) => window.type === "available").reduce((sum, window) => sum + Math.max(0, timeToMinutes(window.end) - timeToMinutes(window.start)), 0);
  const eventDuration = Math.max(0, timeToMinutes(event.cutoffTime) - timeToMinutes(event.entryTime));
  return `<div class="content-column">
    <section class="day-overview panel">
      <div class="day-overview-head"><div><p class="section-kicker">SELECTED DAY</p><h2>${escapeHtml(formatLongDate(event.date))}</h2><p class="muted">${escapeHtml(event.label)} <span class="dot-separator">·</span> ${escapeHtml(event.venue)}</p></div><div class="day-actions"><label class="header-day-picker"><span>表示日</span><select id="header-day-select">${renderCompactDayOptions(event.id)}</select></label><button class="button primary" data-action="open-ticket">チケットを登録</button></div></div>
      <div class="day-stat-grid"><div><span>入場</span><strong>${escapeHtml(event.entryTime)}</strong></div><div><span>締め切り</span><strong>${escapeHtml(event.cutoffTime)}</strong></div><div><span>手持ちチケット</span><strong>${formatNumber(total)}<small>枚</small></strong></div><div class="${alerts ? "has-alert" : "has-success"}"><span>要確認</span><strong>${alerts}<small>件</small></strong></div></div>
    </section>
    <div class="filter-row"><div class="filter-title">タイムラインを絞り込む</div><label class="select-wrap"><span>メンバー</span><select id="member-filter"><option value="all">全員</option>${renderMemberOptions(state.filter.member === "all" ? "" : state.filter.member)}</select></label><label class="select-wrap"><span>状態</span><select id="alert-filter"><option value="all" ${state.filter.alert === "all" ? "selected" : ""}>すべて</option><option value="alert" ${state.filter.alert === "alert" ? "selected" : ""}>注意あり</option><option value="clear" ${state.filter.alert === "clear" ? "selected" : ""}>問題なし</option></select></label></div>
    ${renderTimeline(event)}
  </div>`;
};

const renderSidePanel = (event: EventDay) => {
  const windows = dayWindows(event.id);
  const available = windows.filter((window) => window.type === "available");
  const blocked = windows.filter((window) => window.type === "blocked");
  return `<aside class="side-column">
    <section class="insight-card panel"><div class="insight-top"><span class="section-kicker">AT A GLANCE</span><span class="live-pill"><i></i>LOCAL ONLY</span></div><h3>参加できる時間</h3><div class="availability-total">${available.length ? available.map((window) => `<strong>${escapeHtml(window.start)}<small>–</small>${escapeHtml(window.end)}</strong>`).join("") : `<strong class="muted">未設定</strong>`}</div><p>${available.length ? "参加可能時間の中に予定を収めて、時間とメンバーを確認しましょう。" : "参加可能時間を追加すると、チケットが収まるか自動でチェックできます。"}</p><div class="progress-bar"><span style="width:${available.length ? Math.min(100, (available.reduce((sum, window) => sum + (timeToMinutes(window.end) - timeToMinutes(window.start)), 0) / Math.max(1, timeToMinutes(event.cutoffTime) - timeToMinutes(event.entryTime))) * 100) : 0}%"></span></div><div class="insight-foot"><span>${available.length ? `${Math.round((available.reduce((sum, window) => sum + (timeToMinutes(window.end) - timeToMinutes(window.start)), 0) / Math.max(1, timeToMinutes(event.cutoffTime) - timeToMinutes(event.entryTime))) * 100)}% が参加可能` : "設定待ち"}</span><span>${formatNumber(Math.round((timeToMinutes(event.cutoffTime) - timeToMinutes(event.entryTime)) / 60 * 10) / 10)}h 開催</span></div></section>
    <section class="windows-card panel"><div class="panel-heading"><div><p class="section-kicker">AVAILABILITY</p><h3>参加時間の設定</h3></div><button class="text-button" data-action="open-window">＋追加</button></div><div class="window-list">${windows.length ? windows.map((window) => `<div class="window-row ${window.type}"><span class="window-mark"></span><div><strong>${escapeHtml(window.start)}–${escapeHtml(window.end)}</strong><small>${escapeHtml(window.type === "available" ? "参加可能" : "参加不可")}${window.note ? ` ・ ${escapeHtml(window.note)}` : ""}</small></div><button class="row-edit" data-action="edit-window" data-id="${escapeHtml(window.id)}">編集</button><button class="row-delete" data-action="delete-window" data-id="${escapeHtml(window.id)}">削除</button></div>`).join("") : `<div class="empty-state small"><span>まだ時間帯がありません</span></div>`}</div></section>
  </aside>`;
};

const renderTicketTable = () => {
  const tickets = state.tickets.filter((ticket) => {
    const matchesEvent = state.filter.eventId === "all" || ticket.eventId === state.filter.eventId;
    const matchesMember = state.filter.member === "all" || ticket.member === state.filter.member;
    const matchesAlert = state.filter.alert === "all" || (state.filter.alert === "alert" ? getTicketAlerts(ticket).length > 0 : getTicketAlerts(ticket).length === 0);
    return matchesEvent && matchesMember && matchesAlert;
  }).sort((a, b) => {
    const dayA = state.eventDays.find((day) => day.id === a.eventId)?.date ?? "";
    const dayB = state.eventDays.find((day) => day.id === b.eventId)?.date ?? "";
    return dayA.localeCompare(dayB) || timeToMinutes(a.start) - timeToMinutes(b.start);
  });
  return `<div class="content-column full-width"><section class="panel tickets-panel"><div class="panel-heading ticket-table-heading"><div><p class="section-kicker">ALL TICKETS</p><h2>手持ちチケット</h2><p class="muted">日付・メンバー・時間をまとめて編集できます。</p></div><button class="button primary" data-action="open-ticket">チケットを登録</button></div><div class="ticket-filter-row"><span>絞り込み</span><label class="select-wrap"><span>日程</span><select id="date-filter"><option value="all">すべて</option>${state.eventDays.map((day) => `<option value="${escapeHtml(day.id)}" ${state.filter.eventId === day.id ? "selected" : ""}>${escapeHtml(formatDate(day.date))}</option>`).join("")}</select></label><label class="select-wrap"><span>メンバー</span><select id="member-filter"><option value="all">全員</option>${renderMemberOptions(state.filter.member === "all" ? "" : state.filter.member)}</select></label><label class="select-wrap"><span>状態</span><select id="alert-filter"><option value="all" ${state.filter.alert === "all" ? "selected" : ""}>すべて</option><option value="alert" ${state.filter.alert === "alert" ? "selected" : ""}>注意あり</option><option value="clear" ${state.filter.alert === "clear" ? "selected" : ""}>問題なし</option></select></label></div><div class="table-wrap"><table><thead><tr><th>日付</th><th>メンバー</th><th>時間 / 部</th><th>枚数</th><th>状態</th><th>操作</th></tr></thead><tbody>${tickets.length ? tickets.map((ticket) => { const event = state.eventDays.find((day) => day.id === ticket.eventId); const alerts = getTicketAlerts(ticket); return `<tr><td><strong>${event ? escapeHtml(formatDate(event.date)) : "—"}</strong><small>${event ? escapeHtml(event.label) : "日程未設定"}</small></td><td><span class="member-cell"><i class="member-dot ${memberClass(ticket.member)}"></i>${renderTicketMemberLabel(ticket)}</span></td><td><strong>${escapeHtml(ticket.start)}–${escapeHtml(ticket.end)}</strong><small>${escapeHtml(ticket.slot)}</small></td><td><strong>×${escapeHtml(ticket.qty)}</strong></td><td>${alerts.length ? `<div class="table-alerts">${alerts.slice(0, 2).map((alert) => renderBadge(alert, "alert")).join("")}</div>` : renderBadge("問題なし", "success")}</td><td><button class="table-action" data-action="edit-ticket" data-id="${escapeHtml(ticket.id)}">編集</button><button class="table-action danger" data-action="delete-ticket" data-id="${escapeHtml(ticket.id)}">削除</button></td></tr>`; }).join("") : `<tr><td colspan="6"><div class="empty-state"><strong>該当するチケットがありません</strong><span>条件を変えるか、「チケットを登録」から予定を作成してください。</span></div></td></tr>`}</tbody></table></div></section></div>`;
};

const renderApp = () => {
  const event = selectedDay();
  const hasDays = state.eventDays.length > 0 && event;
  const totalTickets = getTotalTickets();
  const alertCount = getTotalAlertCount();
  const totalMembers = new Set(state.tickets.map((ticket) => ticket.member)).size;
  document.querySelector<HTMLDivElement>("#app")!.innerHTML = `<div class="app-shell">
    <header class="topbar"><a class="brand" href="#" data-action="home"><span class="brand-mark"><i></i><i></i><i></i></span><span><b>forTUNE</b><small>BEYOOOOONDS fan tool</small></span></a><div class="topbar-actions"><button class="ghost-button" data-action="import">JSONを読み込む</button><button class="ghost-button" data-action="export">バックアップを書き出す</button><input type="file" id="import-file" accept="application/json" hidden /><span class="user-chip"><span class="avatar">MY</span>マイプラン</span></div></header>
    <main class="main-shell">
      <section class="summary-strip"><div class="summary-main"><span class="summary-label">次のイベント</span><strong>${hasDays ? escapeHtml(formatDate(event.date)) : "日程を追加"}</strong><span>${hasDays ? `${escapeHtml(event.label)} ・ ${escapeHtml(event.entryTime)}–${escapeHtml(event.cutoffTime)}` : "まず開催日を登録してください"}</span></div><div class="summary-stat"><span>登録日程</span><strong>${state.eventDays.length}<small>日</small></strong></div><div class="summary-stat"><span>チケット</span><strong>${formatNumber(totalTickets)}<small>枚</small></strong></div><div class="summary-stat ${alertCount ? "warning" : "good"}"><span>要確認</span><strong>${alertCount}<small>件</small></strong></div></section>
      <nav class="view-tabs"><button class="view-tab ${state.activeTab === "overview" ? "active" : ""}" data-action="set-tab" data-tab="overview"><span class="tab-index">01</span>日別タイムライン</button><button class="view-tab ${state.activeTab === "tickets" ? "active" : ""}" data-action="set-tab" data-tab="tickets"><span class="tab-index">02</span>チケット一覧</button><span class="tabs-spacer"></span></nav>
      ${state.activeTab === "tickets" ? `${renderScheduleSwitcher(event)}${renderTicketTable()}` : `<div class="workspace">${hasDays ? `<div class="main-grid">${renderOverview(event)}${renderSidePanel(event)}</div>` : `<div class="empty-state panel"><strong>日付を選ぶとタイムラインが表示されます</strong><span>下の「日程を選ぶ」から日付を選択してください。</span></div>`}</div>${renderScheduleSwitcher(event)}`}
      <footer class="footer"><span>forTUNE music fan timetable</span><span>入力内容はこのブラウザに保存されます</span></footer>
    </main>
    ${renderDialogs()}
  </div>`;
  bindEvents();
};

const renderDialogs = () => `<dialog id="day-dialog" class="app-dialog"><form method="dialog" id="day-form"><div class="dialog-header"><div><p class="section-kicker">EVENT DAY</p><h2>${editingDayId ? "日程を編集" : "参加日程を追加"}</h2></div><button type="button" class="dialog-close" data-action="close-dialog" data-dialog="day-dialog" aria-label="閉じる">×</button></div><div class="form-grid"><label class="field full"><span>開催日</span><input name="date" type="date" required /></label><label class="field full"><span>イベント名</span><input name="label" placeholder="例：個別チェキ会" required /></label><label class="field full"><span>会場</span><input name="venue" placeholder="例：ベルサール渋谷ファースト" /></label><label class="field"><span>入場開始</span><input name="entryTime" type="time" required /></label><label class="field"><span>締め切り</span><input name="cutoffTime" type="time" required /></label></div><div class="dialog-footer"><button type="button" class="button subtle" data-action="close-dialog" data-dialog="day-dialog">キャンセル</button>${editingDayId ? `<button type="button" class="text-button danger-text" data-action="delete-day" data-id="${escapeHtml(editingDayId)}">この日程を削除</button>` : ""}<button class="button primary" value="default">保存する</button></div></form></dialog>
<dialog id="ticket-dialog" class="app-dialog"><form method="dialog" id="ticket-form"><div class="dialog-header"><div><p class="section-kicker">TICKET PLAN</p><h2>${editingTicketId ? "チケットを編集" : "チケットを追加"}</h2><p class="dialog-intro">表示中の日程にチケットを登録します。イベント内容を選ぶと、組み合わせ・受付時間・締切が自動で入ります。</p></div><button type="button" class="dialog-close" data-action="close-dialog" data-dialog="ticket-dialog" aria-label="閉じる">×</button></div><div class="form-grid"><input type="hidden" name="eventId" value="${escapeHtml(state.selectedEventId)}" /><div class="ticket-fixed-day"><span>参加日程</span><strong>${escapeHtml(formatDate(state.eventDays.find((day) => day.id === state.selectedEventId)?.date ?? ""))} ・ ${escapeHtml(state.eventDays.find((day) => day.id === state.selectedEventId)?.venue ?? "")}</strong><small>日程を変更する場合は、先に画面上部の「表示日」を切り替えてください。</small></div><div id="ticket-slot-field" class="field full">${renderTicketSlotField(state.selectedEventId)}</div><div id="ticket-member-field" class="field full">${renderTicketMemberField(state.selectedEventId)}</div><label class="field"><span>入場受付 <small>自動入力</small></span><input id="ticket-start" name="start" type="time" readonly required /></label><label class="field"><span>入場締切 <small>自動入力</small></span><input id="ticket-end" name="end" type="time" readonly required /></label><label class="field"><span>枚数</span><input name="qty" type="number" min="1" max="99" value="1" required /></label><label class="field full"><span>メモ <small>任意</small></span><input name="note" placeholder="例：ポーズ記入済み、本人照会あり など" /></label></div><div class="dialog-footer"><button type="button" class="button subtle" data-action="close-dialog" data-dialog="ticket-dialog">キャンセル</button><button class="button primary" value="default">保存する</button></div></form></dialog>
<dialog id="window-dialog" class="app-dialog"><form method="dialog" id="window-form"><div class="dialog-header"><div><p class="section-kicker">AVAILABILITY</p><h2>${editingWindowId ? "参加時間を編集" : "参加時間を追加"}</h2></div><button type="button" class="dialog-close" data-action="close-dialog" data-dialog="window-dialog" aria-label="閉じる">×</button></div><div class="form-grid"><label class="field full"><span>参加日程</span><select name="eventId" required>${renderDayOptions(state.selectedEventId)}</select></label><label class="field full"><span>種類</span><select name="type"><option value="available">参加可能時間</option><option value="blocked">参加不可時間</option></select></label><label class="field"><span>開始時間</span><input name="start" type="time" required /></label><label class="field"><span>終了時間</span><input name="end" type="time" required /></label><label class="field full"><span>メモ <small>任意</small></span><input name="note" placeholder="例：昼食・移動 など" /></label></div><p class="form-help">参加不可時間に重なるチケットは、タイムライン上で注意表示になります。</p><div class="dialog-footer"><button type="button" class="button subtle" data-action="close-dialog" data-dialog="window-dialog">キャンセル</button>${editingWindowId ? `<button type="button" class="text-button danger-text" data-action="delete-window" data-id="${escapeHtml(editingWindowId)}">この時間帯を削除</button>` : ""}<button class="button primary" value="default">保存する</button></div></form></dialog>`;

const fillForm = (form: HTMLFormElement, values: object) => Object.entries(values).forEach(([key, value]) => { const field = form.elements.namedItem(key) as HTMLInputElement | HTMLSelectElement | null; if (field) field.value = String(value); });
const openDayDialog = (dayId?: string) => {
  editingDayId = dayId ?? null;
  renderApp();
  const dialog = document.querySelector<HTMLDialogElement>("#day-dialog")!;
  const form = document.querySelector<HTMLFormElement>("#day-form")!;
  const event = dayId ? state.eventDays.find((day) => day.id === dayId) : undefined;
  fillForm(form, event ?? { date: "2026-12-01", label: "", venue: "", entryTime: "10:00", cutoffTime: "18:00", officialSlots: [] });
  dialog.showModal();
};
const syncTicketTimeFields = () => {
  const eventId = document.querySelector<HTMLInputElement>("input[name=eventId]")?.value ?? state.selectedEventId;
  const slotField = document.querySelector<HTMLSelectElement>("#ticket-slot-select");
  const slot = slotField ? selectedOfficialSlot(eventId, slotField.value) : undefined;
  const start = document.querySelector<HTMLInputElement>("#ticket-start");
  const end = document.querySelector<HTMLInputElement>("#ticket-end");
  if (start && end) {
    if (slot) { start.value = slot.entryTime; end.value = slot.cutoffTime; start.readOnly = true; end.readOnly = true; }
    else { start.readOnly = false; end.readOnly = false; }
  }
};
const refreshTicketSlotFields = () => {
  const eventId = document.querySelector<HTMLInputElement>("input[name=eventId]")?.value ?? state.selectedEventId;
  const slotName = document.querySelector<HTMLSelectElement>("#ticket-slot-select")?.value;
  const currentMember = document.querySelector<HTMLSelectElement>("#ticket-member-field select[name=member]")?.value ?? "";
  const currentPurchaseGroup = document.querySelector<HTMLSelectElement>("#ticket-member-field select[name=purchaseGroup]")?.value ?? "";
  const memberField = document.querySelector<HTMLDivElement>("#ticket-member-field");
  if (memberField) memberField.innerHTML = renderTicketMemberField(eventId, slotName, currentMember, currentPurchaseGroup);
  document.querySelector<HTMLSelectElement>("#ticket-member-field select[name=purchaseGroup]")?.addEventListener("change", refreshTicketSlotFields);
  syncTicketTimeFields();
};
const openTicketDialog = (ticketId?: string) => {
  editingTicketId = ticketId ?? null;
  const ticket = ticketId ? state.tickets.find((item) => item.id === ticketId) : undefined;
  if (ticket) state.selectedEventId = ticket.eventId;
  renderApp();
  const dialog = document.querySelector<HTMLDialogElement>("#ticket-dialog")!;
  const form = document.querySelector<HTMLFormElement>("#ticket-form")!;
  const defaultSlot = selectedOfficialSlot(state.selectedEventId);
  const ticketSlot = ticket ? selectedOfficialSlot(ticket.eventId, ticket.slot) : undefined;
  const normalizedTicket = ticket && ticketSlot?.category === "個別お話し会" && ticket.member.startsWith("グループ") ? { ...ticket, purchaseGroup: ticket.purchaseGroup ?? ticket.member, member: "未確定" } : ticket;
  fillForm(form, normalizedTicket ?? { eventId: state.selectedEventId, member: "", slot: defaultSlot?.name ?? "", qty: 1, start: defaultSlot?.entryTime ?? "10:00", end: defaultSlot?.cutoffTime ?? "10:15", note: "" });
  dialog.showModal();
  refreshTicketSlotFields();
};
const openWindowDialog = (windowId?: string) => {
  editingWindowId = windowId ?? null;
  renderApp();
  const dialog = document.querySelector<HTMLDialogElement>("#window-dialog")!;
  const form = document.querySelector<HTMLFormElement>("#window-form")!;
  const window = windowId ? state.windows.find((item) => item.id === windowId) : undefined;
  fillForm(form, window ?? { eventId: state.selectedEventId, type: "available", start: "10:30", end: "17:00", note: "" });
  dialog.showModal();
};

const bindEvents = () => {
  document.querySelectorAll<HTMLElement>("[data-action]").forEach((element) => element.addEventListener("click", () => {
    const action = element.dataset.action;
    const itemId = element.dataset.id;
    if (action === "set-tab") { state.activeTab = element.dataset.tab === "tickets" ? "tickets" : "overview"; persist(); renderApp(); }
    if (action === "select-day" && itemId) { state.selectedEventId = itemId; state.activeTab = "overview"; persist(); renderApp(); }
    if (action === "open-day") openDayDialog();
    if (action === "edit-day" && itemId) openDayDialog(itemId);
    if (action === "delete-day" && itemId && confirm("この日程と、紐づくチケット・時間帯を削除しますか？")) { state.eventDays = state.eventDays.filter((day) => day.id !== itemId); state.tickets = state.tickets.filter((ticket) => ticket.eventId !== itemId); state.windows = state.windows.filter((window) => window.eventId !== itemId); state.selectedEventId = state.eventDays[0]?.id ?? ""; editingDayId = null; persist(); (document.querySelector<HTMLDialogElement>("#day-dialog"))?.close(); renderApp(); }
    if (action === "open-ticket") openTicketDialog();
    if (action === "edit-ticket" && itemId) openTicketDialog(itemId);
    if (action === "toggle-ticket-done" && itemId) { state.tickets = state.tickets.map((ticket) => ticket.id === itemId ? { ...ticket, done: !ticket.done } : ticket); persist(); renderApp(); }
    if (action === "open-window") openWindowDialog();
    if (action === "edit-window" && itemId) openWindowDialog(itemId);
    if (action === "delete-window" && itemId && confirm("この参加時間を削除しますか？")) { state.windows = state.windows.filter((window) => window.id !== itemId); editingWindowId = null; persist(); (document.querySelector<HTMLDialogElement>("#window-dialog"))?.close(); renderApp(); }
    if (action === "delete-ticket" && itemId && confirm("このチケットを削除しますか？")) { state.tickets = state.tickets.filter((ticket) => ticket.id !== itemId); persist(); renderApp(); }
    if (action === "close-dialog" && element.dataset.dialog) { document.querySelector<HTMLDialogElement>(`#${element.dataset.dialog}`)?.close(); editingDayId = null; editingTicketId = null; editingWindowId = null; }
    if (action === "home") { state.activeTab = "overview"; persist(); renderApp(); }
    if (action === "export") exportState();
    if (action === "import") document.querySelector<HTMLInputElement>("#import-file")?.click();
  }));
  document.querySelector<HTMLSelectElement>("#header-day-select")?.addEventListener("change", (event) => { state.selectedEventId = (event.target as HTMLSelectElement).value; state.activeTab = "overview"; persist(); renderApp(); });
  document.querySelector<HTMLSelectElement>("#ticket-slot-select")?.addEventListener("change", refreshTicketSlotFields);
  document.querySelector<HTMLSelectElement>("#date-filter")?.addEventListener("change", (event) => { state.filter.eventId = (event.target as HTMLSelectElement).value; persist(); renderApp(); });
  document.querySelector<HTMLSelectElement>("#member-filter")?.addEventListener("change", (event) => { state.filter.member = (event.target as HTMLSelectElement).value; persist(); renderApp(); });
  document.querySelector<HTMLSelectElement>("#alert-filter")?.addEventListener("change", (event) => { state.filter.alert = (event.target as HTMLSelectElement).value as FilterState["alert"]; persist(); renderApp(); });
  document.querySelector<HTMLInputElement>("#import-file")?.addEventListener("change", importState);
  document.querySelector<HTMLFormElement>("#day-form")?.addEventListener("submit", (event) => { event.preventDefault(); const form = event.currentTarget as HTMLFormElement; const data = new FormData(form); const existing = editingDayId ? state.eventDays.find((day) => day.id === editingDayId) : undefined; const item: EventDay = { id: editingDayId ?? id("event"), date: String(data.get("date")), label: String(data.get("label")), venue: String(data.get("venue")), entryTime: String(data.get("entryTime")), cutoffTime: String(data.get("cutoffTime")), officialSlots: existing?.officialSlots ?? [] }; if (timeToMinutes(item.entryTime) >= timeToMinutes(item.cutoffTime)) return alert("締め切りは入場開始より後の時間にしてください。"); if (editingDayId) state.eventDays = state.eventDays.map((day) => day.id === editingDayId ? item : day); else { state.eventDays.push(item); state.selectedEventId = item.id; } persist(); (document.querySelector<HTMLDialogElement>("#day-dialog"))?.close(); editingDayId = null; renderApp(); });
  document.querySelector<HTMLFormElement>("#ticket-form")?.addEventListener("submit", (event) => { event.preventDefault(); const form = event.currentTarget as HTMLFormElement; const data = new FormData(form); const existing = editingTicketId ? state.tickets.find((ticket) => ticket.id === editingTicketId) : undefined; const purchaseGroup = String(data.get("purchaseGroup") ?? ""); const item: Ticket = { id: editingTicketId ?? id("ticket"), eventId: String(data.get("eventId")), member: String(data.get("member")), purchaseGroup: purchaseGroup || undefined, slot: String(data.get("slot")), start: String(data.get("start")), end: String(data.get("end")), qty: Number(data.get("qty")), note: String(data.get("note")), done: existing?.done ?? false }; if (timeToMinutes(item.start) >= timeToMinutes(item.end)) return alert("終了時間は開始時間より後にしてください。"); if (editingTicketId) state.tickets = state.tickets.map((ticket) => ticket.id === editingTicketId ? item : ticket); else state.tickets.push(item); state.selectedEventId = item.eventId; persist(); (document.querySelector<HTMLDialogElement>("#ticket-dialog"))?.close(); editingTicketId = null; renderApp(); });
  document.querySelector<HTMLFormElement>("#window-form")?.addEventListener("submit", (event) => { event.preventDefault(); const form = event.currentTarget as HTMLFormElement; const data = new FormData(form); const item: AvailabilityWindow = { id: editingWindowId ?? id("window"), eventId: String(data.get("eventId")), type: String(data.get("type")) as AvailabilityWindow["type"], start: String(data.get("start")), end: String(data.get("end")), note: String(data.get("note")) }; if (timeToMinutes(item.start) >= timeToMinutes(item.end)) return alert("終了時間は開始時間より後の時間にしてください。"); if (editingWindowId) state.windows = state.windows.map((window) => window.id === editingWindowId ? item : window); else state.windows.push(item); state.selectedEventId = item.eventId; persist(); (document.querySelector<HTMLDialogElement>("#window-dialog"))?.close(); editingWindowId = null; renderApp(); });
};

const exportState = () => { const blob = new Blob([JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `fortune-timetable-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url); };
const importState = async (event: Event) => { const input = event.target as HTMLInputElement; const file = input.files?.[0]; if (!file) return; try { const imported = JSON.parse(await file.text()) as AppState; if (!Array.isArray(imported.eventDays) || !Array.isArray(imported.tickets)) throw new Error("invalid"); state = { eventDays: imported.eventDays, tickets: imported.tickets, windows: Array.isArray(imported.windows) ? imported.windows : [], selectedEventId: imported.eventDays[0]?.id ?? "", activeTab: "overview", filter: { eventId: "all", member: "all", alert: "all" } }; persist(); renderApp(); } catch { alert("読み込めるJSONではありませんでした。"); } input.value = ""; };

renderApp();
