export type RelayDataField = {
  field_name: string;
  field_value: string;
};

export type RelayDriver = {
  id: string;
  phone: string;
  first_name: string;
  last_name: string;
  email?: string | null;
  data_fields?: RelayDataField[];
  integration_id?: string;
  created_at: string;
  updated_at: string;
};

export type RelayMerchant = {
  name?: string;
  number?: string;
};

export type RelayLocation = {
  id: string;
  name?: string;
  fuel_merchant_location_id?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  latitude?: number;
  longitude?: number;
  opis_id?: string;
  timezone?: string;
};

export type RelayFuelItem = {
  fuel_type?: string;
  fuel_type_description?: string;
  fuel_product_code?: string;
  retail_price_per_unit?: string;
  discounted_price_per_unit?: string;
  volume?: string;
  volume_uom?: string;
  total_retail_price?: string;
  total_discounted_price?: string;
};

export type RelayTransaction = {
  transaction_id: string;
  created_at: string;
  relay_fuel_code?: string;
  total_amount_paid?: string;
  total_retail_price?: string;
  total_amount_saved?: string;
  is_direct_bill?: boolean;
  currency_code?: string;
  merchant?: RelayMerchant;
  location?: RelayLocation;
  fuel_items?: RelayFuelItem[];
  fuel_code_type?: string;
};
