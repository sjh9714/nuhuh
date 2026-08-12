package median

import "sort"

func Median(xs []float64) float64 {
	s := append([]float64(nil), xs...)
	sort.Float64s(s)
	return s[len(s)/2]
}
