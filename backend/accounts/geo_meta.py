"""Region lists for employer address autocomplete (states/provinces by ISO country code)."""

# Full names; matches common Nominatim / postcode API spellings where possible.

AU_STATES = [
    "Australian Capital Territory",
    "New South Wales",
    "Northern Territory",
    "Queensland",
    "South Australia",
    "Tasmania",
    "Victoria",
    "Western Australia",
]

NZ_REGIONS = [
    "Auckland",
    "Bay of Plenty",
    "Canterbury",
    "Gisborne",
    "Hawke's Bay",
    "Manawatū-Whanganui",
    "Marlborough",
    "Nelson",
    "Northland",
    "Otago",
    "Southland",
    "Taranaki",
    "Tasman",
    "Waikato",
    "Wellington",
    "West Coast",
]

CA_PROVINCES = [
    "Alberta",
    "British Columbia",
    "Manitoba",
    "New Brunswick",
    "Newfoundland and Labrador",
    "Northwest Territories",
    "Nova Scotia",
    "Nunavut",
    "Ontario",
    "Prince Edward Island",
    "Quebec",
    "Saskatchewan",
    "Yukon",
]

GB_NATIONS = [
    "England",
    "Northern Ireland",
    "Scotland",
    "Wales",
]

DE_STATES = [
    "Baden-Württemberg",
    "Bavaria",
    "Berlin",
    "Brandenburg",
    "Bremen",
    "Hamburg",
    "Hesse",
    "Lower Saxony",
    "Mecklenburg-Vorpommern",
    "North Rhine-Westphalia",
    "Rhineland-Palatinate",
    "Saarland",
    "Saxony",
    "Saxony-Anhalt",
    "Schleswig-Holstein",
    "Thuringia",
]

FR_REGIONS = [
    "Auvergne-Rhône-Alpes",
    "Bourgogne-Franche-Comté",
    "Brittany",
    "Centre-Val de Loire",
    "Corsica",
    "Grand Est",
    "Hauts-de-France",
    "Île-de-France",
    "Normandy",
    "Nouvelle-Aquitaine",
    "Occitanie",
    "Pays de la Loire",
    "Provence-Alpes-Côte d'Azur",
]

IN_STATES = [
    "Andhra Pradesh",
    "Arunachal Pradesh",
    "Assam",
    "Bihar",
    "Chhattisgarh",
    "Goa",
    "Gujarat",
    "Haryana",
    "Himachal Pradesh",
    "Jharkhand",
    "Karnataka",
    "Kerala",
    "Madhya Pradesh",
    "Maharashtra",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Odisha",
    "Punjab",
    "Rajasthan",
    "Sikkim",
    "Tamil Nadu",
    "Telangana",
    "Tripura",
    "Uttar Pradesh",
    "Uttarakhand",
    "West Bengal",
]

# US — 50 states + DC
_US = (
    "Alabama,Alaska,Arizona,Arkansas,California,Colorado,Connecticut,Delaware,District of Columbia,"
    "Florida,Georgia,Hawaii,Idaho,Illinois,Indiana,Iowa,Kansas,Kentucky,Louisiana,Maine,Maryland,"
    "Massachusetts,Michigan,Minnesota,Mississippi,Missouri,Montana,Nebraska,Nevada,New Hampshire,"
    "New Jersey,New Mexico,New York,North Carolina,North Dakota,Ohio,Oklahoma,Oregon,Pennsylvania,"
    "Rhode Island,South Carolina,South Dakota,Tennessee,Texas,Utah,Vermont,Virginia,Washington,"
    "West Virginia,Wisconsin,Wyoming"
)
US_STATES = [s.strip() for s in _US.split(",")]

STATES_BY_COUNTRY = {
    "AU": AU_STATES,
    "NZ": NZ_REGIONS,
    "CA": CA_PROVINCES,
    "GB": GB_NATIONS,
    "DE": DE_STATES,
    "FR": FR_REGIONS,
    "IN": IN_STATES,
    "US": US_STATES,
}
