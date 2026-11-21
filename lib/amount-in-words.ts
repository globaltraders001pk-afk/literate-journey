/**
 * Number-to-words converter for PKR invoice amounts.
 *
 * International grouping (Thousand / Million / Billion) with hyphenated
 * compound tens, e.g. 138980 ->
 * "Pakistani Rupees One Hundred Thirty-Eight Thousand Nine Hundred Eighty Only."
 */

const ONES = [
  'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
]

const TENS = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
]

const SCALES = ['', 'Thousand', 'Million', 'Billion', 'Trillion', 'Quadrillion']

/** Words for a number from 0 to 999. */
function underThousand(n: number): string {
  const parts: string[] = []
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  if (hundreds > 0) {
    parts.push(`${ONES[hundreds]} Hundred`)
  }
  if (rest > 0) {
    if (rest < 20) {
      parts.push(ONES[rest])
    } else {
      const tens = Math.floor(rest / 10)
      const ones = rest % 10
      parts.push(ones > 0 ? `${TENS[tens]}-${ONES[ones]}` : TENS[tens])
    }
  }
  return parts.join(' ')
}

/** Words for a whole non-negative integer, international grouping. */
function integerWords(n: number): string {
  if (n === 0) return 'Zero'
  if (!Number.isFinite(n) || n < 0) return 'Zero'
  const groups: string[] = []
  let scale = 0
  let remaining = Math.floor(n)
  while (remaining > 0) {
    const chunk = remaining % 1000
    if (chunk > 0) {
      const words = underThousand(chunk)
      groups.unshift(SCALES[scale] ? `${words} ${SCALES[scale]}` : words)
    }
    remaining = Math.floor(remaining / 1000)
    scale += 1
  }
  return groups.join(' ')
}

/**
 * Full amount in words, e.g. amountInWords(138980) ===
 * "Pakistani Rupees One Hundred Thirty-Eight Thousand Nine Hundred Eighty Only."
 * Fractional rupees are spelled out as paisa.
 */
export function amountInWords(amount: number): string {
  const value = Number(amount) || 0
  const negative = value < 0
  const abs = Math.abs(value)
  // Round the WHOLE amount to paisa first (QA audit M2): the old
  // code floored the rupees and rounded the leftover fraction, so
  // 0.995 rounded its paisa to 100 without carrying it into the
  // rupees, and 1.005 lost its paisa to binary float error
  // (1.005 is stored as 1.0049999…, so ×100 lands just below the
  // .5 boundary). The epsilon nudge puts decimal inputs on the
  // side their written value implies.
  const totalPaisa = Math.round((abs + Number.EPSILON) * 100)
  const rupees = Math.floor(totalPaisa / 100)
  const paisa = totalPaisa % 100

  let words = `Pakistani Rupees ${integerWords(rupees)}`
  if (paisa > 0) {
    words += ` and ${integerWords(paisa)} Paisa`
  }
  if (negative) {
    // The negative branch rebuilds the same words — including the
    // paisa clause the old code dropped ("-500.75" printed as
    // "Negative Five Hundred Only").
    words = `Pakistani Rupees Negative ${integerWords(rupees)}`
    if (paisa > 0) {
      words += ` and ${integerWords(paisa)} Paisa`
    }
  }
  return `${words} Only.`
}
