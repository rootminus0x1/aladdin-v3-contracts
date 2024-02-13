datafile = "aladdin-fx-market-plot.CRxETH.gnuplot.dat"
# set terminal pngcairo
# set output "aladdin-fx-market-plot.CRxETH.gnuplot.png
set terminal svg
# set output "aladdin-fx-market-plot.CRxETH.gnuplot.svg
set xlabel "Ether Price (USD)
set colorsequence podo
set ylabel "collateral ratio"
set xrange reverse
plot datafile using 1:2 with lines linewidth 2 dashtype 2 title "stETHTreasury.collateralRatio" ,\
     datafile using 1:3 with lines  title "stETHTreasury.collateralRatio.liquidate:RebalancePool(wstETHWrapper)" ,\
     datafile using 1:4 with lines  title "stETHTreasury.collateralRatio.liquidate:BoostableRebalancePool__0(wstETHWrapper)" ,\
     datafile using 1:5 with lines  title "stETHTreasury.collateralRatio.liquidate:BoostableRebalancePool__1(StETHAndxETHWrapper)" 