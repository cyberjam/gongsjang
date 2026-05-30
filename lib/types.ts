export type RecordType = "pullup" | "chinup" | "muscleup" | "hang";

export const RECORD_TYPES: { value: RecordType; label: string; unit: string }[] = [
  { value: "pullup", label: "풀업", unit: "회" },
  { value: "chinup", label: "친업", unit: "회" },
  { value: "muscleup", label: "머슬업", unit: "회" },
  { value: "hang", label: "데드행", unit: "초" },
];

export const RECORD_TYPE_LABEL: Record<RecordType, string> = {
  pullup: "풀업",
  chinup: "친업",
  muscleup: "머슬업",
  hang: "데드행",
};

export const RECORD_TYPE_UNIT: Record<RecordType, string> = {
  pullup: "회",
  chinup: "회",
  muscleup: "회",
  hang: "초",
};

export type Location = {
  id: string;
  name: string;
  address: string | null;
  description: string | null;
  lat: number;
  lng: number;
  created_at: string;
};

// 장소를 점령 중인 문파 (지도 마커 색·배지용 최소 정보)
export type ClanBadge = { name: string; color: string };

// 문파 점령 랭킹 (HUD/우세 문파용)
export type ClanStat = {
  id: string;
  name: string;
  slug: string;
  color: string;
  count: number;
};

// 동네 문파 (자동 생성 세력)
export type Clan = {
  id: string;
  name: string;
  slug: string;
  region_key: string; // 동/읍/면
  color: string;
};

// 장소 점령 현황 (Stage 점령전 패널)
export type StageOccupation = {
  clan: ClanBadge | null; // null = 무주공산
  warden: string | null; // 관장(기여 1위)
  power: number; // 점령력(최근 30일 방문)
  occupiedSince: string | null;
};

export type LocationWithStats = Location & {
  recordCount: number;
  topPullup: { value: number; nickname: string } | null;
  // 현재 점령 문파 — null = 무주공산(회색)
  clan?: ClanBadge | null;
};

export type RecordRow = {
  id: string;
  location_id: string;
  nickname: string;
  record_type: RecordType;
  value: number;
  memo: string | null;
  created_at: string;
};
