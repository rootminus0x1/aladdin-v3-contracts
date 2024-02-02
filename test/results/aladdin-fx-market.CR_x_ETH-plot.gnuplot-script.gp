datafile = "aladdin-fx-market.CR_x_ETH-plot.gnuplot.dat"
# set terminal pngcairo
# set output "aladdin-fx-market.CR_x_ETH-plot.gnuplot.png"
set terminal svg
# set output "aladdin-fx-market.CR_x_ETH-plot.gnuplot.png"
set xlabel "ETH"
set ylabel "stETHTreasury.collateralRatio" # TODO: this should be the units, not the name
set ytics nomirror
set y2label "stETHTreasury.leverageRatio"
set y2tics

#stats datafile using 1 nooutput
#min = STATS_min
#max = STATS_max
#range_extension = 0.2 * (max - min)
#set xrange [min - range_extension : max + range_extension]

#stats datafile using 2 nooutput
#min = STATS_min
#max = STATS_max
#range_extension = 0.2 * (max - min)
#set yrange [min - range_extension : max + range_extension]

#stats datafile using 3 nooutput
#min = STATS_min
#max = STATS_max
#range_extension = 0.2 * (max - min)
#set y2range [min - range_extension : max + range_extension]

plot datafile using 1:2 with lines title "stETHTreasury.collateralRatio",     datafile using 1:3 with lines title "stETHTreasury.leverageRatio" axes x1y2
