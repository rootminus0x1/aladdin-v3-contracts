datafile = "aladdin-fx-market.CR_x_ETH-plot.CRxETH.gnuplot.dat"
# set terminal pngcairo
# set output "aladdin-fx-market.CR_x_ETH-plot.CRxETH.gnuplot.png"
set terminal svg
# set output "aladdin-fx-market.CR_x_ETH-plot.CRxETH.gnuplot.svg"
set xlabel "Ether Price (USD)"
set ylabel "collateral ratio"
set ytics nomirror

set xrange reverse
plot datafile using 1:2 with lines dashtype 1 linewidth 1 title "stETHTreasury.collateralRatio",\
     datafile using 1:3 with lines dashtype 2 linewidth 2 title "stETHTreasury.collateralRatio.liquidate"