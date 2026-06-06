i dont see anything great being implemented by my code here - seems like im just calling a bunch of built-in function i need to have a solid code implementation that will bring real and great value and make the engine powerful can we reiterate the code and see how we can make it unique, powerful and never done before

================= What did we build? ==================

================ What i am building? ===================
- not an inventory calculator that has some formulas coded and executed.

- what needs to be built => A Self-Correcting Stochastic Inventory Control 

- Layer 01
    - we are constructing demand from real pharmacy inventory movements stored in mongodb

    - most important since every later decision depends on it

    - we shall build a layer that scans the inventory event and gives us a Clean Demand Time-series

    - pharmacy database records events: stock_in, stock_out, adjustment and return

    - but forecasting does not want events, it simply needs True Consumption -> so we convert raw transactions to trustworhty processable data signal

    - functions of layer 01:
        - connect to mongodb
        - extract stock movements
        - remove supplier deliveries
        - ignore corrections
        - detect data corruptions
        - aggregate monthly demands
        - fill missing months
        - flag anomalies
        - output clean series for the ai layer
=======================================================================

demand / month = (outstock - instock) /month

ACTUAL_DEMAND FORMULA:
demadn / jan =  inventory on 1st jan + order_received - inventory on 31st jan
         29  = 20 + 50 - 41

1st jan = 20
7th jan = 15 (sold 5 units)
22nd jan = 50 received my order of 50 units (sold 15 units)
31st jan = 41 (sold 9 units)
actual demand = 29 units 

1st jan = 20
2nd jan = 19 + 50 = 69 (sold 1)
20th jan = 15 (sold 54)
22nd jan = 09 + 50 = 59  
31st jan = 32 (sold 27)
demand = [1, 54, 6, 27]
actual_demand = 88 units

jan = 












threshold = 15
safety_stock =  =>  
instock = dec 01st = 100 units
outstock = 
instock = jan 25th = 


inventory table
dolo:
dosageForm is a varible that tells us what kind of medicine it is => a syrup / a tablet / a cream etc. = threshold for each of such a category must be taken care of 
baseqty: 15 = mapped 
qty: 2
subqty: baseqty * qty 30 


rorderqty -> only when rop hits 

rop? when willu calcuate 

====================================================================================================
Chnages to be made to the AI Algorithm 

demand/month = read the inventory on first day of the month + qty ordered in the - read the inventory on the last day of the month 

1. Unit Conversion Logic 
    - baseQuantity = 
    - Tablet, Capsule = units and subunits  
    - Syrups, Creams = units
2. Medicine Priority Classification 
3. Construction of Appropriate Dataset 

====================================================================================================
PROCUREMENT AGENT
1. Preferred distributor =>   ask from the pharmacy
2. Budgetary Constraints handling => pharmacy has a set bduget per month for spending money, Order must be within this budget => order cycles determine the number of orders that needs to be reordered
3. Scheme Optimization => frontend / but lets see how this can be done = NOT AS HIGH PRIORITY 

AGENTIC_FLOW:
AI Algorithm runs 
|
Outputs the number of qty that needs to be re-ordered 
| 


====================================================================================================
This for one medicine:
read the inventory on first day of the month = 100 - temp file
qty ordered = 50 - temp file
read the inv on the last day of the month = 50 - temp file [number of units left in the pharmacy at month-end] 

demand = f + q - l = 100 + 50 - 50 = 100 [number of units sold in that month] => stockPurchaseHistory db 

write demand value to a db 
date  med_a  
month demand
Jan   100

erase the temp file 

temp file is empty for the next month
======================================================================================================