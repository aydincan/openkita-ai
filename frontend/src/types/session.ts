export type SessionUser = {
  id: string;
  facility_id: string;
  email: string;
  display_name: string;
  role: "administrator" | "educator";
  is_active: boolean;
};

export type Facility = {
  id: string;
  name: string;
  exposure_region_code: string | null;
  exposure_region_label: string | null;
};
