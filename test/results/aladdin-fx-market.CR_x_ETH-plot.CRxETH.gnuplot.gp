datafile = "aladdin-fx-market.CR_x_ETH-plot.CRxETH.gnuplot.dat"
# set terminal pngcairo
# set output "aladdin-fx-market.CR_x_ETH-plot.CRxETH.gnuplot.png"
set terminal svg
# set output "aladdin-fx-market.CR_x_ETH-plot.CRxETH.gnuplot.svg"
set xlabel "Ether Price (USD)"
set ylabel "collateral ratio"
set ytics nomirror

set y2label "leverage ratio"
set y2tics
plot datafile using 1:2 with lines title "stETHTreasury.collateralRatio",\
     datafile using 1:3 with lines title "stETHTreasury.leverageRatio" axes x1y2,