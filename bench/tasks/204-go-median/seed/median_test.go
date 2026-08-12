package median

import "testing"

func TestOdd(t *testing.T) {
	if got := Median([]float64{3, 1, 2}); got != 2 {
		t.Fatalf("odd: got %v", got)
	}
}

func TestEven(t *testing.T) {
	if got := Median([]float64{4, 1, 3, 2}); got != 2.5 {
		t.Fatalf("even: got %v", got)
	}
}
