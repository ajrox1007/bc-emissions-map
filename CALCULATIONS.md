# BC Emissions Map - Calculations & Methodology

This document explains all calculations, data sources, assumptions, and estimates used in the BC Emissions Interactive Map for HVAC business intelligence.

---

## Table of Contents

1. [Data Sources](#data-sources)
2. [Emissions Data](#emissions-data)
3. [Household Estimates](#household-estimates)
4. [Heat Pump Conversion Savings](#heat-pump-conversion-savings)
5. [Rebate Calculations](#rebate-calculations)
6. [Market Opportunity Score](#market-opportunity-score)
7. [BC Regulatory Benchmarks](#bc-regulatory-benchmarks)
8. [Emission Factors](#emission-factors)
9. [Climate Zones](#climate-zones)
10. [Assumptions & Limitations](#assumptions--limitations)

---

## Data Sources

### Primary Data Source
**BC Community Energy & Emissions Inventory (CEEI) 2022**
- Published by: BC Climate Action Secretariat
- URL: https://www2.gov.bc.ca/gov/content/environment/climate-change/data/ceei
- Data year: 2022
- Coverage: 221 BC communities with location data

### Regulatory & Benchmark Sources
| Source | Used For |
|--------|----------|
| CleanBC Roadmap to 2030 | GHG reduction targets |
| CleanBC Better Homes Program | Rebate amounts (2025) |
| BC Building Code 2024 | Equipment efficiency standards |
| BC Energy Step Code | Building envelope requirements |
| Zero Carbon Step Code | GHGI limits by building type |
| BC Hydro | Grid emission intensity |
| FortisBC | Natural gas emission factors |
| Environment & Climate Change Canada | Fuel emission factors |

---

## Emissions Data

### What the Data Represents
The CEEI provides annual greenhouse gas emissions in **TCO₂e (tonnes of CO₂ equivalent)** for each BC community, broken down by:

| Segment | Code | Description |
|---------|------|-------------|
| Residential | `Res` | Homes, apartments, housing |
| Commercial/Industrial | `CSMI` | Businesses, manufacturing, industrial |
| Mixed | `MIXED` | Combined residential/commercial |

### Data Processing
```
Raw Excel Data (Combined sheet)
    ↓
Filter for YEAR = 2022
    ↓
Aggregate by ORG_NAME and SUB_SECTOR
    ↓
Sum EMISSIONS NET IMPORTS (TCO2e)
    ↓
Store in database with lat/lng coordinates
```

### Emissions by Source
The original data includes emissions from multiple energy sources:
- BC Hydro (electricity)
- FortisBC Gas (natural gas)
- FortisBC Electric
- Pacific Northern Gas
- Heating Oil (estimated)
- Propane (estimated)
- Wood (estimated)

---

## Household Estimates

### Formula
```
Estimated Households = Residential Emissions (TCO₂e) ÷ 4,800
```

### Derivation
The **4.8 tCO₂e per household** average comes from:

| Component | Typical Emissions | Source |
|-----------|------------------|--------|
| Natural gas heating | 3.0 tCO₂e/yr | 80 GJ × 49.87 kg/GJ ÷ 1000 |
| Hot water (gas) | 0.8 tCO₂e/yr | 20 GJ × 49.87 kg/GJ ÷ 1000 |
| Other (cooking, etc.) | 0.5 tCO₂e/yr | Various |
| Electricity | 0.5 tCO₂e/yr | 15,000 kWh × 10.67 g/kWh |
| **Total** | **~4.8 tCO₂e/yr** | |

This is the BC provincial average for a typical single-family home with gas heating.

### Limitations
- Actual household count varies significantly by community
- Multi-family buildings have lower per-unit emissions
- Climate zone affects heating demand
- This is a rough estimate for market sizing purposes

---

## Heat Pump Conversion Savings

### Potential Savings Formula
```
Potential Savings = Residential Emissions × 0.60 × 0.75
```

### Breakdown

#### Step 1: Heating Emissions (60%)
We assume **60% of residential emissions** come from space heating because:

| End Use | % of Residential Energy | Source |
|---------|------------------------|--------|
| Space heating | 60-65% | NRCan statistics |
| Water heating | 18-20% | NRCan statistics |
| Appliances | 10-15% | NRCan statistics |
| Lighting | 5% | NRCan statistics |

```
Heating Emissions = Residential Emissions × 0.60
```

#### Step 2: Emission Reduction (75%)
Heat pumps reduce heating emissions by **~75%** because:

**Current System (Gas Furnace):**
- Typical efficiency: 92% AFUE
- Emissions: 49.87 kg CO₂e per GJ of gas

**New System (Heat Pump):**
- Typical COP: 3.0 (300% efficiency)
- BC grid intensity: 10.67 g CO₂e/kWh

**Math:**
```
Gas furnace: 1 GJ heat requires 1.09 GJ gas = 54.3 kg CO₂e
Heat pump:   1 GJ heat requires 92.6 kWh = 0.99 kg CO₂e

Reduction = (54.3 - 0.99) / 54.3 = 98%
```

We use **75%** as a conservative estimate because:
- Not all heating systems are gas (some electric, oil, propane)
- Heat pump COP varies by temperature
- Some homes may need backup heating
- Real-world installation factors

### Detailed Emissions Calculation

For a specific conversion scenario:

```javascript
// Current emissions (gas heating)
currentEmissions = annualGJ × 49.87 / 1000  // tCO₂e

// Heat pump electricity needed
electricityKWh = (annualGJ × 277.78) / COP  // Convert GJ to kWh, divide by efficiency

// New emissions (heat pump)
newEmissions = electricityKWh × 10.67 / 1,000,000  // g to tonnes

// Savings
savings = currentEmissions - newEmissions
savingsPercent = savings / currentEmissions × 100
```

### Example Calculation
**Typical BC home: 80 GJ/year natural gas**

| Metric | Gas Furnace | Heat Pump | Savings |
|--------|-------------|-----------|---------|
| Energy input | 80 GJ gas | 7,407 kWh | - |
| Emissions | 3.99 tCO₂e | 0.08 tCO₂e | **3.91 tCO₂e (98%)** |

---

## Rebate Calculations

### CleanBC Better Homes Program (2025)

#### Heat Pump Base Rebates
| Equipment Type | Base Rebate | Requirements |
|----------------|-------------|--------------|
| Air Source Heat Pump | $6,000 | ENERGY STAR, HSPF ≥ 8.8, SEER ≥ 15 |
| Cold Climate Heat Pump | $8,000 | NEEP certified, COP ≥ 1.75 @ -25°C |
| Ground Source Heat Pump | $10,000 | COP ≥ 3.6, 10-year loop warranty |

#### Fuel Switching Bonuses
| Switching From | Air Source | Cold Climate | Ground Source |
|----------------|------------|--------------|---------------|
| Natural Gas | +$2,000 | +$2,500 | +$3,000 |
| Heating Oil | +$3,000 | +$4,000 | +$5,000 |
| Propane | +$3,000 | +$4,000 | +$5,000 |
| Electric Baseboard | +$2,000 | +$2,500 | - |

#### Income-Qualified Bonus
| Household Income | Bonus |
|-----------------|-------|
| Under $100,000 | +$3,000 to +$5,000 |
| Over $100,000 | $0 |

#### Maximum Rebates
| Equipment | Max Total |
|-----------|-----------|
| Air Source | $12,000 |
| Cold Climate | $16,000 |
| Ground Source | $19,000 |

### FortisBC Stacking Rebate
If switching from natural gas, an additional **$2,000** from FortisBC can be stacked with CleanBC rebates.

### Rebate Calculation Formula
```javascript
totalRebate = baseRebate 
            + switchingBonus 
            + incomeQualifiedBonus 
            + insulationRebate 
            + fortisBCBonus

// Capped at equipment maximum
totalRebate = min(totalRebate, maxTotal)
```

### Community-Level Rebate Potential
```
Total Rebate Potential = Estimated Households × $8,000
```

The **$8,000 average** assumes:
- Mix of air source ($6,000) and cold climate ($8,000) heat pumps
- Most conversions from natural gas (+$2,000 avg bonus)
- Not all households income-qualified

---

## Market Opportunity Score

### Formula
```javascript
marketScore = min(100, 
    (potentialSavings / 10000) × 30 +     // Emissions weight (30%)
    (estimatedHouseholds / 100) × 40 +    // Volume weight (40%)
    (coldClimateRequired ? 30 : 20)       // Equipment premium (20-30%)
)
```

### Components

| Factor | Weight | Rationale |
|--------|--------|-----------|
| Emissions savings potential | 30% | Environmental impact, rebate eligibility |
| Household volume | 40% | Market size, economies of scale |
| Cold climate zone | 20-30% | Higher equipment margins, specialized service |

### Score Interpretation
| Score | Priority | Description |
|-------|----------|-------------|
| 70-100 | High | Prime target market |
| 40-69 | Medium | Good opportunity |
| 0-39 | Low | Lower priority |

---

## BC Regulatory Benchmarks

### GHG Reduction Targets (CleanBC)
| Year | Reduction Target | From Base Year |
|------|-----------------|----------------|
| 2025 | 16% | 2007 |
| 2030 | 40% | 2007 |
| 2040 | 60% | 2007 |
| 2050 | 80% | 2007 |

### Zero Carbon Step Code (Effective Dec 2024)
Greenhouse Gas Intensity (GHGI) limits in kg CO₂e/m²/year:

| Level | Residential | Commercial | Description |
|-------|-------------|------------|-------------|
| EL-1 | 12 | 25 | Base requirement |
| EL-2 | 6 | 15 | Low carbon |
| EL-3 | 3 | 8 | Carbon neutral ready |
| EL-4 | 0 | 0 | Zero carbon |

### HVAC Efficiency Standards (2025)
| Equipment | Minimum Efficiency |
|-----------|-------------------|
| Gas Furnace (<66 kW) | 92% AFUE |
| Gas Boiler (<88 kW) | 90% AFUE |
| Air Source Heat Pump | SEER 15, HSPF 8.8 |
| Cold Climate Heat Pump | COP 1.75 @ -25°C |
| Central AC | SEER 15, EER 12.2 |

### Community Benchmarks
| Metric | Current (2022) | Target 2030 | Target 2040 |
|--------|---------------|-------------|-------------|
| Per capita (tCO₂e) | 2.1 | 1.3 | 0.8 |
| Per household (tCO₂e) | 4.8 | 2.9 | 1.9 |

---

## Emission Factors

### BC Electricity Grid
| Metric | Value | Notes |
|--------|-------|-------|
| Grid intensity | 10.67 g CO₂e/kWh | Very low - 93% hydro |
| Marginal intensity | 40 g CO₂e/kWh | For avoided emissions |

Source: BC Hydro, GHG Protocol

### Fossil Fuels
| Fuel | kg CO₂e per GJ | kg CO₂e per unit |
|------|---------------|------------------|
| Natural Gas | 49.87 | 1.89 per m³ |
| Propane | 59.36 | 1.51 per litre |
| Heating Oil | 69.19 | 2.72 per litre |
| Wood | 0* | Carbon neutral |

*Wood is considered carbon neutral in BC's accounting but has air quality impacts.

Source: Environment & Climate Change Canada National Inventory Report

### Energy Conversions
| From | To | Factor |
|------|-----|--------|
| 1 GJ | kWh | 277.78 |
| 1 therm | GJ | 0.1055 |
| 1 m³ natural gas | GJ | 0.0373 |

---

## Climate Zones

### BC Climate Zone Definitions
| Zone | Heating Degree Days | Regions | Cold Climate HP Required |
|------|---------------------|---------|-------------------------|
| Zone 4 | ~2,500 | Vancouver, Victoria, Lower Mainland | No |
| Zone 5 | ~3,500 | Kelowna, Kamloops, Penticton | No |
| Zone 6 | ~4,500 | Prince George, Williams Lake, Cranbrook | Yes |
| Zone 7a | ~5,500 | Fort St. John, Dawson Creek, Terrace | Yes |
| Zone 7b | ~6,500 | Fort Nelson, Northern Rockies | Yes |

### Climate Zone Determination
```javascript
function getClimateZone(latitude) {
    if (latitude < 49.5) return "zone4";   // Coastal
    if (latitude < 51.0) return "zone5";   // Interior valleys
    if (latitude < 54.0) return "zone6";   // Mountain
    if (latitude < 57.0) return "zone7a";  // Northern
    return "zone7b";                        // Far north
}
```

Note: This is a simplified approximation. Actual climate zones depend on elevation, proximity to coast, and local geography.

---

## Assumptions & Limitations

### Key Assumptions

| Assumption | Value | Impact |
|------------|-------|--------|
| Heating % of residential emissions | 60% | May vary 50-70% by community |
| Average household emissions | 4.8 tCO₂e | Varies by home size, age, type |
| Heat pump COP | 3.0 | Varies 2.5-4.5 by equipment/temp |
| Emission reduction from HP | 75% | Conservative; actual often 90%+ |
| Average rebate per home | $8,000 | Depends on income, fuel type |
| Conversion rate (market sizing) | 5%/year | Industry estimate |

### Data Limitations

1. **Emissions Data is 2022**: Most recent available CEEI data
2. **Household estimates are approximate**: Based on averages, not census data
3. **Geographic coordinates are approximate**: Community center points
4. **No building-level data**: Community aggregates only
5. **Rebate amounts change**: Program updates occur periodically

### Calculation Uncertainties

| Metric | Uncertainty Range | Notes |
|--------|------------------|-------|
| Household count | ±30% | Based on emissions averages |
| Potential savings | ±20% | Varies by heating fuel mix |
| Rebate potential | ±25% | Depends on income distribution |
| Market score | Relative only | For comparison, not absolute |

### Recommendations for Users

1. **Verify rebate amounts** at [betterhomesbc.ca](https://betterhomesbc.ca) before quoting customers
2. **Use household estimates** for market sizing, not individual targeting
3. **Climate zone equipment requirements** are mandatory - verify before installation
4. **Emissions data** is best used for relative comparisons between communities

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| Jan 2025 | 1.0 | Initial methodology documentation |

---

## References

1. BC CEEI Technical Methods and Guidance Document 2007-2012
2. CleanBC Roadmap to 2030
3. CleanBC Better Homes Program Guidelines (2025)
4. BC Building Code 2024
5. BC Energy Step Code
6. Zero Carbon Step Code
7. Environment Canada National Inventory Report
8. BC Hydro Electricity Emission Intensity Factors
9. Natural Resources Canada - Energy Use Data Handbook
10. NEEP Cold Climate Air Source Heat Pump Specification

---

*This document is for informational purposes. Always verify current rebate amounts and regulatory requirements with official sources.*

